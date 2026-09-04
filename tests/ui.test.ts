import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner, RunResult } from "../src/contracts";
import {
  EDITOR_MAX_VISIBLE_LINE_COUNT,
  EDITOR_SOURCE_LINE_LIMIT,
  INTELLIJ_DARCULA_COLORS
} from "../src/editor";
import { mountRunnableBlock } from "../src/ui";

function createRunner(overrides: Partial<CodeRunner> = {}): CodeRunner {
  return {
    environment: "browser",
    language: "javascript",
    availability: async () => ({ available: true, detail: "ready" }),
    run: async () => ({ durationMs: 1.5, exitCode: 0, stderr: "", stdout: "ok\n" }),
    ...overrides
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("runnable block UI", () => {
  it("resets the edited CodeMirror document and clears output", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const mounted = mountRunnableBlock(host, {
      code: "console.log('source')",
      language: "javascript",
      runner: createRunner()
    });
    await Promise.resolve();
    const content = host.querySelector<HTMLElement>(".cm-content");
    expect(content?.hasAttribute("aria-label")).toBe(false);
    const labelledBy = content?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")?.textContent).toBe(
      "javascript runnable code editor"
    );
    expect(host.querySelectorAll(".cm-line")).toHaveLength(3);
    expect(
      Array.from(host.querySelectorAll(".cm-lineNumbers .cm-gutterElement"), (line) => line.textContent)
        .filter(Boolean)
        .slice(-3)
    ).toEqual(["1", "2", "3"]);
    content?.dispatchEvent(new InputEvent("beforeinput", { data: "changed", inputType: "insertText" }));
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--secondary")?.click();

    expect(host.querySelector(".rcb__status")?.textContent).toBe("Ready to run");
    expect(host.querySelector(".rcb__output")?.textContent).toBe("");
    expect(host.querySelector<HTMLElement>(".rcb__console")?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>(".rcb__button--secondary")?.hidden).toBe(true);
    expect(host.querySelectorAll(".cm-line")).toHaveLength(3);
    mounted.dispose();
    expect(host.querySelector(".rcb")).toBeNull();
  });

  it("uses the IntelliJ Darcula syntax palette", () => {
    expect(INTELLIJ_DARCULA_COLORS).toMatchObject({
      function: "#56A8F5",
      identifier: "#BCBEC4",
      keyword: "#CF8E6D",
      number: "#2AACB8",
      string: "#6AAB73"
    });
  });

  it("renders both Run icons without treating multiple classes as one token", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "console.log('source')",
      language: "javascript",
      runner: createRunner()
    });
    await Promise.resolve();

    expect(host.querySelector(".rcb__button-icon--run")).not.toBeNull();
    expect(host.querySelector(".rcb__button-icon--running")).not.toBeNull();
    expect(host.querySelector(".cm-editor")).not.toBeNull();
  });

  it("lets 100 source lines plus two numbered editing lines grow before scrolling", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: Array.from({ length: EDITOR_SOURCE_LINE_LIMIT }, (_, index) => `// ${String(index + 1)}`).join("\n"),
      language: "javascript",
      runner: createRunner()
    });
    await Promise.resolve();

    const editorHost = host.querySelector<HTMLElement>(".rcb__editor");
    expect(EDITOR_MAX_VISIBLE_LINE_COUNT).toBe(102);
    expect(editorHost?.style.getPropertyValue("--rcb-editor-max-height")).toBe(
      "calc(102lh + 16px)"
    );
    expect(EDITOR_MAX_VISIBLE_LINE_COUNT - EDITOR_SOURCE_LINE_LIMIT).toBe(2);
  });

  it("shows runner exceptions as console errors", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "throw new Error()",
      language: "javascript",
      runner: createRunner({ run: async () => { throw new Error("sandbox failed"); } })
    });
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector(".rcb")?.getAttribute("data-state")).toBe("error");
    expect(host.querySelector(".rcb__output")?.textContent).toBe("sandbox failed");
  });

  it("shows a stable animated running action and waiting output", async () => {
    let finish: ((result: RunResult) => void) | undefined;
    const result = new Promise<RunResult>((resolve) => {
      finish = resolve;
    });
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "console.log('later')",
      language: "javascript",
      runner: createRunner({ run: async () => await result })
    });
    await Promise.resolve();

    const button = host.querySelector<HTMLButtonElement>(".rcb__button--run");
    button?.click();
    await Promise.resolve();

    expect(button?.getAttribute("aria-busy")).toBe("true");
    expect(button?.textContent).toBe("Running…");
    expect(host.querySelector<SVGElement>(".rcb__button-icon--running")?.hasAttribute("hidden")).toBe(false);
    expect(host.querySelector(".rcb__console-meta")?.textContent).toBe("Running…");
    expect(host.querySelector(".rcb__output")?.textContent).toBe("Waiting for result…");

    finish?.({ durationMs: 12, exitCode: 0, provider: "Test runner", stderr: "", stdout: "done" });
    await Promise.resolve();
    await Promise.resolve();

    expect(button?.getAttribute("aria-busy")).toBe("false");
    expect(button?.textContent).toBe("Run");
    expect(host.querySelector(".rcb__console-meta")?.textContent).toBe("Success · 12 ms · Test runner");
  });

  it("clears previous result metadata before showing a later runner error", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const runner = createRunner({
      run: vi
        .fn()
        .mockResolvedValueOnce({
          durationMs: 2,
          exitCode: 0,
          provider: "First provider",
          stderr: "",
          stdout: "ok"
        })
        .mockRejectedValueOnce(new Error("second run failed"))
    });
    mountRunnableBlock(host, { code: "code", language: "javascript", runner });
    await Promise.resolve();
    const button = host.querySelector<HTMLButtonElement>(".rcb__button--run");
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".rcb__console-meta")?.textContent).toBe("Success · 2 ms · First provider");

    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".rcb__console-meta")?.textContent).toBe("Runner error");
    expect(host.querySelector(".rcb__output")?.textContent).toBe("second run failed");
  });

  it("disables execution when the runner is unavailable", async () => {
    const run = vi.fn();
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "fun main() {}",
      language: "kotlin",
      runner: createRunner({
        language: "kotlin",
        availability: async () => ({ available: false, detail: "kotlinc missing" }),
        run
      })
    });
    await Promise.resolve();

    const button = host.querySelector<HTMLButtonElement>(".rcb__button--run");
    expect(button?.disabled).toBe(true);
    button?.click();
    expect(run).not.toHaveBeenCalled();
    expect(host.querySelector(".rcb__notice")?.textContent).toBe("kotlinc missing");
    expect(host.querySelector<HTMLElement>(".rcb__notice")?.hidden).toBe(false);
  });

  it("turns availability exceptions into a stable unavailable state", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "print('hello')",
      language: "python",
      runner: createRunner({
        availability: async () => { throw new Error("provider preflight crashed"); }
      })
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector(".rcb")?.getAttribute("data-state")).toBe("unavailable");
    expect(host.querySelector<HTMLButtonElement>(".rcb__button--run")?.disabled).toBe(true);
    expect(host.querySelector(".rcb__notice")?.textContent).toBe("provider preflight crashed");
  });

  it("renders stderr and empty successful output deterministically", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const runner = createRunner({
      run: vi
        .fn()
        .mockResolvedValueOnce({ durationMs: 2, exitCode: 1, stderr: "compile error\n", stdout: "partial\n" })
        .mockResolvedValueOnce({ durationMs: 2, exitCode: 0, stderr: "", stdout: "" })
    });
    mountRunnableBlock(host, { code: "code", language: "javascript", runner });
    await Promise.resolve();
    const button = host.querySelector<HTMLButtonElement>(".rcb__button--run");
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".rcb__output")?.textContent).toBe("partial\ncompile error");
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".rcb__output")?.textContent).toBe("Process finished with no output.");
  });

  it("renders HTML previews in a script-disabled sandbox", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "<h1>Hello</h1>",
      language: "html",
      runner: createRunner({
        language: "html",
        run: async () => ({
          durationMs: 0,
          exitCode: 0,
          preview: { html: "<h1>Hello</h1>", kind: "html", scripts: "blocked" },
          stderr: "",
          stdout: "Preview rendered."
        })
      })
    });
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const frame = host.querySelector<HTMLIFrameElement>('.rcb__preview-frame');
    expect(frame?.getAttribute("sandbox")).toBe("");
    expect(frame?.srcdoc).toBe("<h1>Hello</h1>");
  });

  it("allows scripts only for the isolated interactive web preview", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "<button>Run</button>",
      language: "web",
      runner: createRunner({
        language: "web",
        run: async () => ({
          durationMs: 0,
          exitCode: 0,
          preview: { html: "<button>Run</button>", kind: "html", scripts: "isolated" },
          provider: "Interactive browser sandbox",
          stderr: "",
          stdout: ""
        })
      })
    });
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const frame = host.querySelector<HTMLIFrameElement>(".rcb__preview-frame");
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.title).toBe("Interactive code preview");
    expect(host.querySelector<HTMLElement>(".rcb__output")?.hidden).toBe(true);
  });

  it("shows the provider environment that actually completed a fallback run", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "console.log('fallback')",
      language: "javascript",
      runner: createRunner({
        environment: "remote",
        run: async () => ({
          durationMs: 1,
          environment: "browser",
          exitCode: 0,
          provider: "Web Worker fallback",
          stderr: "",
          stdout: "fallback"
        })
      })
    });
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector(".rcb")?.getAttribute("data-environment")).toBe("browser");
    expect(host.querySelector(".rcb__environment-name")?.textContent).toBe("Browser");
    expect(host.querySelector(".rcb__status")?.getAttribute("title")).toBe("Web Worker fallback");
  });

  it("keeps output hidden until execution starts", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "console.log('quiet')",
      language: "javascript",
      runner: createRunner()
    });
    await Promise.resolve();

    expect(host.querySelector<HTMLElement>(".rcb__console")?.hidden).toBe(true);
    expect(host.querySelector(".rcb__status")?.textContent).toBe("Ready to run");
  });
});
