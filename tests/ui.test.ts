import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../src/contracts";
import { INTELLIJ_DARCULA_COLORS } from "../src/editor";
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

    expect(host.querySelector(".rcb__status")?.textContent).toBe("Ready");
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
    expect(host.querySelector(".rcb__notice")?.textContent).toBe("kotlinc missing");
    expect(host.querySelector<HTMLElement>(".rcb__notice")?.hidden).toBe(false);
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

  it("keeps output hidden until execution starts", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    mountRunnableBlock(host, {
      code: "console.log('quiet')",
      language: "javascript",
      runner: createRunner()
    });
    await Promise.resolve();

    expect(host.querySelector<HTMLElement>(".rcb__console")?.hidden).toBe(true);
    expect(host.querySelector(".rcb__status")?.textContent).toBe("Ready");
  });
});
