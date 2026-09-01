import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
const sourceFiles = await filesUnder("src", ".ts");
const sourceByFile = new Map(
  await Promise.all(sourceFiles.map(async (file) => [file, await readFile(file, "utf8")]))
);
const source = [...sourceByFile.values()].join("\n");
const readme = await readFile("README.md", "utf8");
const releaseMedia = JSON.parse(await readFile("docs/release-media.json", "utf8"));
const errors = [];

const supportedLanguages = [
  "javascript", "typescript", "python", "sql", "html", "css", "kotlin", "java", "c", "cpp",
  "go", "rust", "csharp", "swift", "ruby", "php", "r", "scala", "dart", "lua", "shell"
];
const requiredAdapters = [
  "src/runners/browser-preview-runner.ts",
  "src/runners/dartpad-runner.ts",
  "src/runners/fallback-runner.ts",
  "src/runners/javascript-runner.ts",
  "src/runners/kotlin-playground-runner.ts",
  "src/runners/swiftfiddle-runner.ts",
  "src/runners/typescript-runner.ts",
  "src/runners/wandbox-runner.ts"
];
const approvedOrigins = new Set([
  "http://www.w3.org",
  "https://api.kotlinlang.org",
  "https://dartpad.dev",
  "https://runner.swift-playground.com",
  "https://stable.api.dartpad.dev",
  "https://wandbox.org"
]);

const { stdout: trackedBundle } = await run("git", ["ls-files", "main.js"]);
if (trackedBundle.trim()) errors.push("main.js must be a release asset, not tracked source");
if (manifest.id !== "runnable-code-blocks") errors.push("unexpected manifest id");
if (packageJson.name !== manifest.id) errors.push("manifest and package names differ");
if (packageJson.version !== manifest.version) errors.push("manifest and package versions differ");
if (versions[manifest.version] !== manifest.minAppVersion) errors.push("versions.json does not match manifest");
if (releaseMedia.version !== manifest.version) errors.push("release media version does not match manifest");
if (releaseMedia.publicSafeSample !== true) errors.push("release media must use a public-safe sample");
if (manifest.isDesktopOnly !== false) errors.push("browser/remote-only plugin must remain available beyond desktop");
if (!packageJson.repository?.url?.endsWith("woonyong-kr/runnable-code-blocks.git")) {
  errors.push("package repository is not the approved source");
}
for (const file of [
  "main.js",
  "manifest.json",
  "styles.css",
  "dist-site/index.html",
  "dist-site/main.js",
  "dist-site/styles.css",
  "docs/assets/runnable-code-blocks-demo.gif",
  "docs/assets/runnable-code-blocks-preview.jpg"
]) {
  if ((await stat(file)).size === 0) errors.push(`${file} is empty`);
}
for (const asset of releaseMedia.assets) {
  const data = await readFile(asset.path);
  const digest = createHash("sha256").update(data).digest("hex");
  if (digest !== asset.sha256) errors.push(`${asset.path} hash does not match release-media.json`);
  if (!Number.isInteger(asset.width) || asset.width <= 0) errors.push(`${asset.path} has an invalid width`);
  if (!Number.isInteger(asset.height) || asset.height <= 0) errors.push(`${asset.path} has an invalid height`);
}
for (const file of ["main.js", "dist-site/main.js"]) {
  if ((await stat(file)).size > 5_000_000) errors.push(`${file} exceeds the reviewed 5 MB bundle ceiling`);
  const bundle = await readFile(file, "utf8");
  if (/_0x[0-9a-f]+/iu.test(bundle)) errors.push(`${file} contains an obfuscation-like hexadecimal identifier`);
}
const styles = await readFile("styles.css", "utf8");
if (/!important/u.test(styles)) errors.push("styles.css uses !important");
if (/\bclip-path\s*:/u.test(styles)) errors.push("styles.css uses unsupported clip-path");
if (/-apple-system|BlinkMacSystemFont/u.test(styles)) {
  errors.push("styles.css uses extended system fonts unsupported by the minimum Obsidian version");
}
for (const language of supportedLanguages) {
  if (!readme.includes(`run-${language}`)) errors.push(`README does not document run-${language}`);
  if (!sourceByFile.get("src/supported-languages.ts")?.includes(`language("${language}"`)) {
    errors.push(`supported-language catalog is missing ${language}`);
  }
}
for (const file of requiredAdapters) {
  if (!sourceByFile.has(file)) errors.push(`required adapter is missing: ${file}`);
}
if (!source.includes("parseRunnableFence")) errors.push("shared runnable fence parser is missing");
if (!source.includes("new Worker")) errors.push("browser worker runner is missing");
if (/from\s+["']node:(?:child_process|fs|fs\/promises)["']/u.test(source)) {
  errors.push("runtime source must not access the filesystem or spawn local processes");
}
if (/\.style\.cssText\s*=/u.test(source)) errors.push("runtime source assigns static styles directly");
if (!source.includes("executionState === \"not-started\"")) {
  errors.push("fallback must require a known not-started execution state");
}
if (!readme.includes("does not access the filesystem")) errors.push("Community runtime boundary is not documented");
if (!readme.includes("docs/assets/runnable-code-blocks-demo.gif")) errors.push("README does not show the real execution GIF");
if (!source.includes("script-src \\'none\\'")) errors.push("HTML/CSS previews must block scripts");
const discoveredOrigins = [...source.matchAll(/https?:\/\/[A-Za-z0-9.-]+/gu)].map(([origin]) => origin);
for (const origin of new Set(discoveredOrigins)) {
  if (!approvedOrigins.has(origin)) errors.push(`runtime source contains an unapproved network origin: ${origin}`);
}
if (/\bWebSocket\s*\(/u.test(source)) errors.push("runtime source opens a WebSocket");

if (errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({
  status: "ok",
  adapters: requiredAdapters.length,
  id: manifest.id,
  languages: supportedLanguages.length,
  version: manifest.version
}));

async function filesUnder(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return await filesUnder(path, extension);
    return path.endsWith(extension) ? [path] : [];
  }));
  return nested.flat().sort();
}
