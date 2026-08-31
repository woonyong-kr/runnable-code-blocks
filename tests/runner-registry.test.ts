import { describe, expect, it } from "vitest";
import type { CodeRunner } from "../src/contracts";
import { RunnerRegistry, UnavailableRunner } from "../src/runner-registry";

function runner(language: string): CodeRunner {
  return {
    environment: "browser",
    language,
    availability: async () => ({ available: true, detail: "ready" }),
    run: async () => ({ durationMs: 1, exitCode: 0, stderr: "", stdout: "ok" })
  };
}

describe("RunnerRegistry", () => {
  it("resolves environment-specific runners without changing the language", () => {
    const registry = new RunnerRegistry()
      .register("kotlin", () => runner("kotlin"))
      .register("javascript", () => runner("javascript"));

    expect(registry.languages()).toEqual(["javascript", "kotlin"]);
    expect(registry.create("KOTLIN")?.language).toBe("kotlin");
    expect(registry.create("python")).toBeNull();
  });

  it("rejects invalid language identifiers", () => {
    expect(() => new RunnerRegistry().register("bad language", () => runner("bad"))).toThrow(
      "Invalid runner language"
    );
  });
});

describe("UnavailableRunner", () => {
  it("makes unsupported web execution explicit", async () => {
    const unavailable = new UnavailableRunner("kotlin", "browser", "local only");
    await expect(unavailable.availability()).resolves.toEqual({
      available: false,
      detail: "local only"
    });
    await expect(unavailable.run()).rejects.toThrow("local only");
  });
});

