import { describe, expect, it, vi } from "vitest";
import { BrowserPreviewRunner } from "../src/runners/browser-preview-runner";
import { BrowserTypeScriptRunner } from "../src/runners/typescript-runner";
import type { BrowserJavaScriptRunner } from "../src/runners/javascript-runner";

describe("browser adapters", () => {
  it("wraps HTML and CSS previews in a network-blocking CSP", async () => {
    const html = await new BrowserPreviewRunner("html").run("<h1>Hello</h1>");
    const css = await new BrowserPreviewRunner("css").run(".preview { color: red; }");
    expect(html.preview?.html).toContain("Content-Security-Policy");
    expect(html.preview?.html).toContain("script-src 'none'");
    expect(html.preview?.scripts).toBe("blocked");
    expect(html.preview?.html).toContain("<h1>Hello</h1>");
    expect(css.preview?.html).toContain(".preview { color: red; }");
    expect(css.preview?.html).toContain("Style a real component");
    const documentWithHead = await new BrowserPreviewRunner("html").run("<html><head><title>x</title></head><body>x</body></html>");
    expect(documentWithHead.preview?.html).toContain("<head><meta http-equiv=");
  });

  it("runs an interactive web document in an isolated, network-blocked preview", async () => {
    const result = await new BrowserPreviewRunner("web").run(
      "<button id=run>Run</button><script>console.log('ready')</script>"
    );

    expect(result.provider).toBe("Interactive browser sandbox");
    expect(result.preview?.scripts).toBe("isolated");
    expect(result.preview?.html).toContain("script-src 'unsafe-inline'");
    expect(result.preview?.html).toContain("connect-src 'none'");
    expect(result.preview?.html).toContain("runnable-code-blocks-preview");
    expect(result.preview?.html).toContain("<button id=run>Run</button>");
  });

  it("transpiles TypeScript script blocks before rendering an interactive preview", async () => {
    const result = await new BrowserPreviewRunner("web-ts").run(`
      <button id="run">Run</button>
      <script type="text/typescript">
        const button = document.querySelector<HTMLButtonElement>("#run")!;
        button.textContent = "Ready";
      </script>
    `);

    expect(result.exitCode).toBe(0);
    expect(result.provider).toContain("Sucrase");
    expect(result.preview?.scripts).toBe("isolated");
    expect(result.preview?.html).not.toContain("HTMLButtonElement");
    expect(result.preview?.html).toContain('type="text/javascript"');
  });

  it("reports invalid or missing TypeScript script blocks without opening a preview", async () => {
    const invalid = await new BrowserPreviewRunner("web-ts").run(
      '<script type="text/typescript">const value: = 4;</script>'
    );
    const missing = await new BrowserPreviewRunner("web-ts").run("<button>Run</button>");

    expect(invalid.exitCode).toBe(1);
    expect(invalid.preview).toBeUndefined();
    expect(invalid.stderr).not.toBe("");
    expect(missing.exitCode).toBe(1);
    expect(missing.preview).toBeUndefined();
    expect(missing.stderr).toContain("requires at least one");
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
