import { describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../src/contracts";
import { FallbackRunner } from "../src/runners/fallback-runner";
import { ProviderUnavailableError } from "../src/runners/provider-errors";

function runner(
  environment: CodeRunner["environment"],
  options: { available?: boolean; run?: CodeRunner["run"] } = {}
): CodeRunner {
  return {
    environment,
    language: "python",
    availability: async () => ({ available: options.available ?? true, detail: `${environment} status` }),
    run: options.run ?? (async () => ({ durationMs: 1, exitCode: 0, stderr: "", stdout: environment }))
  };
}

describe("FallbackRunner", () => {
  it("uses the first available provider and records its boundary", async () => {
    const fallback = new FallbackRunner("python", [runner("remote"), runner("browser")]);
    await expect(fallback.availability()).resolves.toMatchObject({ available: true });
    await expect(fallback.run("print(1)")).resolves.toMatchObject({
      environment: "remote",
      provider: "remote",
      stdout: "remote"
    });
  });

  it("falls back only when execution is known not to have started", async () => {
    const browserRun = vi.fn(async () => ({ durationMs: 1, exitCode: 0, stderr: "", stdout: "browser" }));
    const remote = runner("remote", {
      run: async () => { throw new ProviderUnavailableError("rate limited", "not-started"); }
    });
    await expect(new FallbackRunner("python", [remote, runner("browser", { run: browserRun })]).run("code"))
      .resolves.toMatchObject({ stdout: "browser" });
    expect(browserRun).toHaveBeenCalledOnce();
  });

  it("does not execute code twice after an unknown remote outcome", async () => {
    const browserRun = vi.fn();
    const remote = runner("remote", {
      run: async () => { throw new ProviderUnavailableError("response lost", "unknown"); }
    });
    await expect(new FallbackRunner("python", [remote, runner("browser", { run: browserRun })]).run("sideEffect()"))
      .rejects.toThrow("response lost");
    expect(browserRun).not.toHaveBeenCalled();
  });

  it("skips unavailable providers and reports when none can run", async () => {
    const fallback = new FallbackRunner("python", [runner("remote", { available: false }), runner("browser", { available: false })]);
    await expect(fallback.availability()).resolves.toMatchObject({ available: false });
    await expect(fallback.run("code")).rejects.toMatchObject({ executionState: "not-started" });
  });
});
