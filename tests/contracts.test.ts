import { describe, expect, it } from "vitest";
import { fenceForLanguage, parseRunnableFence } from "../src/contracts";

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
});

