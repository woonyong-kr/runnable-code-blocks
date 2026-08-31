import { describe, expect, it, vi } from "vitest";
import { BrowserPreviewRunner } from "../src/runners/browser-preview-runner";
import { BrowserTypeScriptRunner } from "../src/runners/typescript-runner";
import type { BrowserJavaScriptRunner } from "../src/runners/javascript-runner";

describe("browser adapters", () => {
  it("wraps HTML and CSS previews in a network-blocking CSP", async () => {
    const html = await new BrowserPreviewRunner("html").run("<h1>Hello</h1>");
    const css = await new BrowserPreviewRunner("css").run(".preview { color: red; }");
    expect(html.preview?.html).toContain("Content-Security-Policy");
    expect(html.preview?.html).toContain("<h1>Hello</h1>");
    expect(css.preview?.html).toContain(".preview { color: red; }");
    const documentWithHead = await new BrowserPreviewRunner("html").run("<html><head><title>x</title></head><body>x</body></html>");
    expect(documentWithHead.preview?.html).toContain("<head><meta http-equiv=");
  });

  it("reports preview DOM availability", async () => {
    const original = globalThis.document;
    vi.stubGlobal("document", undefined);
    await expect(new BrowserPreviewRunner("html").availability()).resolves.toMatchObject({ available: false });
    vi.stubGlobal("document", original);
    await expect(new BrowserPreviewRunner("html").availability()).resolves.toMatchObject({ available: true });
  });

  it("transpiles TypeScript before delegating to the isolated worker", async () => {
    const run = vi.fn(async () => ({ durationMs: 1, exitCode: 0, stderr: "", stdout: "4" }));
    const javascript = {
      availability: async () => ({ available: true, detail: "ready" }),
      run
    } as unknown as BrowserJavaScriptRunner;
    const runner = new BrowserTypeScriptRunner(javascript);
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run("const value: number = 4; console.log(value);")).resolves.toMatchObject({
      exitCode: 0,
      provider: expect.stringContaining("Sucrase")
    });
    expect(run).toHaveBeenCalledWith(expect.not.stringContaining(": number"));
  });

  it("returns TypeScript transform errors without starting JavaScript", async () => {
    const run = vi.fn();
    const javascript = {
      availability: async () => ({ available: true, detail: "ready" }),
      run
    } as unknown as BrowserJavaScriptRunner;
    const result = await new BrowserTypeScriptRunner(javascript).run("const value: = 4;");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(run).not.toHaveBeenCalled();
  });
});
