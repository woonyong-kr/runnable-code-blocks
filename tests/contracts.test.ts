import { describe, expect, it } from "vitest";
import { fenceForLanguage, parseRunnableFence } from "../src/contracts";
import {
  SUPPORTED_LANGUAGES,
  supportedLanguagesDescription
} from "../src/supported-languages";

describe("runnable fence contract", () => {
  it("parses the same run-language syntax used by Obsidian and web adapters", () => {
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
    expect(SUPPORTED_LANGUAGES.map(({ id }) => id)).toEqual([
      "javascript", "typescript", "python", "sql", "html", "css", "kotlin", "java",
      "c", "cpp", "go", "rust", "csharp", "swift", "ruby", "php", "r", "scala",
      "dart", "lua", "shell"
    ]);
    expect(SUPPORTED_LANGUAGES.every(({ fence, id }) => fence === `run-${id}`)).toBe(true);
    expect(SUPPORTED_LANGUAGES.find(({ id }) => id === "kotlin")).toMatchObject({
      remoteAdapter: "kotlin-playground"
    });
    expect(SUPPORTED_LANGUAGES.filter(({ remoteAdapter }) => remoteAdapter === "wandbox")).toHaveLength(16);
    expect(supportedLanguagesDescription()).toContain("JavaScript — Obsidian: Wandbox → Web Worker");
    expect(supportedLanguagesDescription()).toContain("Kotlin — Obsidian: Kotlin Playground");
  });
});
