import { describe, expect, it } from "vitest";
import type { CodeRunner } from "../src/contracts";
import { composeLanguageRunner, createRunnerRegistry } from "../src/runner-composition";
import { SUPPORTED_LANGUAGES, supportedLanguage } from "../src/supported-languages";

const localRunner = (language: string): CodeRunner => ({
  environment: "local",
  language,
  availability: async () => ({ available: true, detail: "local" }),
  run: async () => ({ durationMs: 1, exitCode: 0, stderr: "", stdout: "local" })
});

describe("runner composition", () => {
  it("registers every language from the declarative catalog", () => {
    const registry = createRunnerRegistry();
    expect(registry.languages()).toEqual(SUPPORTED_LANGUAGES.map(({ id }) => id).sort());
    expect(SUPPORTED_LANGUAGES.map(({ id }) => registry.create(id)?.language)).toEqual(
      SUPPORTED_LANGUAGES.map(({ id }) => id)
    );
  });

  it("keeps provider order configurable without changing Markdown", async () => {
    const python = supportedLanguage("python");
    if (python === null) throw new Error("python missing");
    const privateFirst = composeLanguageRunner(python, {
      executionOrder: "private-first",
      localRunner
    });
    await expect(privateFirst.run("print(1)")).resolves.toMatchObject({ environment: "local" });
  });

  it("provides browser-only previews even when remote execution is disabled", async () => {
    const html = supportedLanguage("html");
    if (html === null) throw new Error("html missing");
    const runner = composeLanguageRunner(html, { remoteExecutionEnabled: false });
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
  });

  it("makes non-browser languages explicitly unavailable in private web mode", async () => {
    const python = supportedLanguage("python");
    if (python === null) throw new Error("python missing");
    const runner = composeLanguageRunner(python, { remoteExecutionEnabled: false });
    await expect(runner.availability()).resolves.toMatchObject({ available: false });
  });
});
