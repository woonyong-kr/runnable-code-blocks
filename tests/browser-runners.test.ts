import { describe, expect, it, vi } from "vitest";
import { BrowserPreviewRunner } from "../src/runners/browser-preview-runner";
import { BrowserTypeScriptRunner } from "../src/runners/typescript-runner";

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
    const document_ = new DOMParser().parseFromString(result.preview?.html ?? "", "text/html");
    expect(document_.querySelector("#run")?.textContent).toBe("Run");
  });

  it("places the security policy in the real document head despite deceptive markup", async () => {
    const result = await new BrowserPreviewRunner("web").run(
      '<!-- <head> is documentation, not a document element --><head><script>console.log("user")</script></head>'
    );

    const document_ = new DOMParser().parseFromString(result.preview?.html ?? "", "text/html");
    const policy = document_.head.firstElementChild;
    expect(policy?.tagName).toBe("META");
    expect(policy?.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(policy?.getAttribute("content")).toContain("connect-src 'none'");
    const scripts = document_.head.querySelectorAll("script");
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.textContent).toContain("runnable-code-blocks-preview");
    expect(scripts[1]?.textContent).toContain('console.log("user")');
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

  it("compiles a React JSX and TypeScript component into the shared isolated preview", async () => {
    const result = await new BrowserPreviewRunner("react").run(`
      import { useState } from "react";
      export default function Counter() {
        const [count, setCount] = useState<number>(0);
        return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
      }
    `);

    expect(result.exitCode).toBe(0);
    expect(result.provider).toMatch(/React \d+\.\d+\.\d+/u);
    expect(result.preview?.scripts).toBe("isolated");
    expect(result.preview?.html).toContain("connect-src 'none'");
    expect(result.preview?.html).toContain('__RCB_REACT_RUNTIME__');
    expect(result.preview?.html).toContain("ReactDOMClient.createRoot");
    expect(result.preview?.html).toContain("React.createElement");
    expect(result.preview?.html).not.toContain("useState<number>");
  });

  it("exposes the bundled ReactDOM and react-dom/client module surfaces", async () => {
    const result = await new BrowserPreviewRunner("react").run(`
      import { createPortal } from "react-dom";
      import { createRoot } from "react-dom/client";
      export default function App() { return <div>{typeof createPortal}:{typeof createRoot}</div>; }
    `);

    expect(result.exitCode).toBe(0);
    expect(result.preview?.html).toContain('specifier === "react-dom"');
    expect(result.preview?.html).toContain('specifier === "react-dom/client"');
  });

  it("reports React JSX and TypeScript compilation errors before opening a preview", async () => {
    const result = await new BrowserPreviewRunner("react").run(
      "export default function Broken() { return <button>"
    );

    expect(result.exitCode).toBe(1);
    expect(result.provider).toMatch(/React \d+\.\d+\.\d+/u);
    expect(result.preview).toBeUndefined();
    expect(result.stderr).not.toBe("");
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
    };
    const runner = new BrowserTypeScriptRunner(javascript);
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run("const value: number = 4; console.log(value);")).resolves.toMatchObject({
      exitCode: 0,
      provider: expect.stringContaining("Sucrase")
    });
    expect(run).toHaveBeenCalledWith(expect.not.stringContaining(": number"), undefined);
  });

  it("returns TypeScript transform errors without starting JavaScript", async () => {
    const run = vi.fn();
    const javascript = {
      availability: async () => ({ available: true, detail: "ready" }),
      run
    };
    const result = await new BrowserTypeScriptRunner(javascript).run("const value: = 4;");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(run).not.toHaveBeenCalled();
  });
});
