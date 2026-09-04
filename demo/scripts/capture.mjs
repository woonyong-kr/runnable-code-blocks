import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frameDirectory = join(pluginRoot, "demo/captures/frames");
mkdirSync(frameDirectory, { recursive: true });

execFileSync("npm", ["run", "build"], { cwd: pluginRoot, stdio: "inherit" });
const server = spawn(process.execPath, ["scripts/serve-demo.mjs"], {
  cwd: pluginRoot,
  stdio: "ignore"
});

let browser;
try {
  await waitForServer("http://127.0.0.1:4173");
  browser = await chromium.launch();
  const page = await browser.newPage({ colorScheme: "dark", viewport: { height: 900, width: 1600 } });
  await page.goto("http://127.0.0.1:4173");
  const featured = page.locator("[data-featured-test-case]");
  await featured.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(frameDirectory, "01-ready.png") });

  await featured.locator(".cm-content").fill(`import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}`);
  await page.screenshot({ path: join(frameDirectory, "02-edited.png") });

  await featured.getByRole("button", { name: "Run code" }).click();
  await page.screenshot({ path: join(frameDirectory, "03-running.png") });
  await featured.locator(".rcb__console-meta").filter({ hasText: /Success/u }).waitFor();
  const counter = featured.locator(".rcb__preview-frame").contentFrame()
    .locator("#preview").contentFrame().getByRole("button");
  await counter.click();
  await counter.filter({ hasText: "Clicked 1 times" }).waitFor();
  await page.screenshot({ path: join(frameDirectory, "04-output.png") });

  await page.getByText("Run every language example").click();
  const webLesson = page.locator(".rcb-site__lesson", {
    has: page.getByRole("heading", { exact: true, name: /Web \(HTML\/CSS\/JS\)/u })
  });
  await webLesson.getByRole("button", { name: "Run code" }).click();
  await webLesson.locator(".rcb__console-meta").filter({ hasText: /Success/u }).waitFor();
  await webLesson.evaluate((element) => {
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 72);
  });
  await page.screenshot({ path: join(frameDirectory, "05-web.png") });

  copyFileSync(join(frameDirectory, "04-output.png"), join(pluginRoot, "docs/assets/runnable-code-blocks-preview.png"));
  copyFileSync(join(frameDirectory, "05-web.png"), join(pluginRoot, "docs/assets/runnable-web-preview.png"));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

execFileSync("npm", ["run", "demo:build"], { cwd: pluginRoot, stdio: "inherit" });
copyFileSync(
  join(pluginRoot, "demo/dist/runnable-code-blocks-demo.gif"),
  join(pluginRoot, "docs/assets/runnable-code-blocks-demo.gif")
);

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Demo server did not start: ${url}`);
}
