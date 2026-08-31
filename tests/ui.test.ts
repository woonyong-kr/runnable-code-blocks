import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../src/contracts";
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
    content?.dispatchEvent(new InputEvent("beforeinput", { data: "changed", inputType: "insertText" }));
    host.querySelector<HTMLButtonElement>(".rcb__button--run")?.click();
    await Promise.resolve();
    await Promise.resolve();
    host.querySelector<HTMLButtonElement>(".rcb__button--secondary")?.click();

    expect(host.querySelector(".rcb__status")?.textContent).toBe("Reset to Markdown source");
    expect(host.querySelector(".rcb__output")?.textContent).toBe("");
    mounted.dispose();
    expect(host.querySelector(".rcb")).toBeNull();
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
    expect(host.querySelector(".rcb__output")?.textContent).toBe("kotlinc missing");
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
});

