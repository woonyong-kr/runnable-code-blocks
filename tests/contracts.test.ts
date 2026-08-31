import { describe, expect, it } from "vitest";
import { fenceForLanguage, parseRunnableFence } from "../src/contracts";
import {
  SUPPORTED_LANGUAGES,
  supportedLanguagesDescription
} from "../src/supported-languages";

describe("runnable fence contract", () => {
  it("parses the same run-language syntax used by local and web adapters", () => {
    expect(parseRunnableFence("run-kotlin")).toBe("kotlin");
    expect(parseRunnableFence(" RUN-JavaScript ")).toBe("javascript");
    expect(parseRunnableFence("kotlin")).toBeNull();
    expect(parseRunnableFence("run-")).toBeNull();
    expect(parseRunnableFence("run-kotlin metadata")).toBeNull();
  });

  it("creates only valid canonical fences", () => {
    expect(fenceForLanguage("Kotlin")).toBe("run-kotlin");
    expect(() => fenceForLanguage("bad language")).toThrow("Invalid runnable language");
  });

  it("lists every implemented language and its environment", () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      {
        id: "javascript",
        label: "JavaScript",
        fence: "run-javascript",
        obsidian: "Browser Web Worker",
        browser: "Browser Web Worker"
      },
      {
        id: "kotlin",
        label: "Kotlin",
        fence: "run-kotlin",
        obsidian: "Local kotlinc + java",
        browser: "Edit only"
      }
    ]);
    expect(supportedLanguagesDescription()).toContain("JavaScript — Obsidian: Browser Web Worker");
    expect(supportedLanguagesDescription()).toContain("Kotlin — Obsidian: Local kotlinc + java");
  });
});
