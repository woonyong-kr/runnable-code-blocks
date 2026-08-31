import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
const sourceFiles = [
  "src/contracts.ts",
  "src/main.ts",
  "src/runners/javascript-runner.ts",
  "src/runners/kotlin-runner.ts",
  "src/web-adapter.ts",
  "site/main.ts"
];
const source = await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")));
const readme = await readFile("README.md", "utf8");
const errors = [];

const { stdout: trackedBundle } = await run("git", ["ls-files", "main.js"]);
if (trackedBundle.trim()) errors.push("main.js must be a release asset, not tracked source");
if (manifest.id !== "runnable-code-blocks") errors.push("unexpected manifest id");
if (packageJson.name !== manifest.id) errors.push("manifest and package names differ");
if (packageJson.version !== manifest.version) errors.push("manifest and package versions differ");
if (versions[manifest.version] !== manifest.minAppVersion) errors.push("versions.json does not match manifest");
if (manifest.isDesktopOnly !== true) errors.push("local process runner requires a desktop-only plugin");
if (!packageJson.repository?.url?.endsWith("woonyong-kr/runnable-code-blocks.git")) {
  errors.push("package repository is not the approved source");
}
for (const file of ["main.js", "manifest.json", "styles.css", "dist-site/index.html", "dist-site/main.js", "dist-site/styles.css"]) {
  if ((await stat(file)).size === 0) errors.push(`${file} is empty`);
}
if ((await stat("main.js")).size > 1_500_000) errors.push("main.js exceeds 1.5 MB");
if (!readme.includes("run-kotlin") || !readme.includes("run-javascript")) {
  errors.push("README does not document the stable fences");
}
if (!source.some((content) => content.includes("parseRunnableFence"))) {
  errors.push("shared runnable fence parser is missing");
}
if (!source.some((content) => content.includes("new Worker"))) {
  errors.push("browser worker runner is missing");
}
if (!source.some((content) => content.includes('mkdtemp(join(tmpdir(), "runnable-code-blocks-")'))) {
  errors.push("local Kotlin runner does not use a private temporary workspace");
}
for (const forbidden of [/\bfetch\s*\(/, /https?:\/\//, /\bWebSocket\s*\(/]) {
  if (source.some((content) => forbidden.test(content))) {
    errors.push(`runtime source contains a network capability: ${String(forbidden)}`);
  }
}

if (errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({ status: "ok", id: manifest.id, version: manifest.version }));

