import { describe, expect, it, vi } from "vitest";
import {
  BrowserJavaScriptRunner,
  type WorkerLike
} from "../src/runners/javascript-runner";

class RespondingWorker implements WorkerLike {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  terminated = false;

  postMessage(message: { token: string }): void {
    queueMicrotask(() => {
      this.onmessage?.(
        new MessageEvent("message", {
          data: { durationMs: 3.4, logs: ["2, 4, 6"], token: message.token }
        })
      );
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("BrowserJavaScriptRunner", () => {
  it("reports whether Web Workers are available", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(new BrowserJavaScriptRunner().availability()).resolves.toMatchObject({
      available: false
    });
    class TestWorker {
      readonly kind = "test-worker";
    }
    vi.stubGlobal("Worker", TestWorker);
    await expect(new BrowserJavaScriptRunner().availability()).resolves.toMatchObject({
      available: true
    });
    vi.unstubAllGlobals();
  });

  it("returns output from an ephemeral worker and revokes its URL", async () => {
    const worker = new RespondingWorker();
    const revoke = vi.fn();
    const runner = new BrowserJavaScriptRunner({
      workerFactory: () => worker,
      urlFactory: () => "blob:test-worker",
      urlRevoke: revoke
    });

    const result = await runner.run("console.log([1, 2, 3].map(x => x * 2))");

    expect(result).toEqual({
      durationMs: 3.4,
      exitCode: 0,
      stderr: "",
      stdout: "2, 4, 6"
    });
    expect(worker.terminated).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:test-worker");
  });

  it("rejects dynamic imports before creating a worker", async () => {
    const workerFactory = vi.fn();
    const runner = new BrowserJavaScriptRunner({
      workerFactory,
      urlFactory: () => "blob:unused",
      urlRevoke: () => undefined
    });

    await expect(runner.run('await import("https://example.com/module.js")')).resolves.toMatchObject({
      environment: "browser",
      exitCode: 1,
      stderr: expect.stringContaining("Dynamic import")
    });
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it("terminates code that exceeds the execution timeout", async () => {
    vi.useFakeTimers();
    const worker = new RespondingWorker();
    worker.postMessage = () => undefined;
    const runner = new BrowserJavaScriptRunner({
      timeoutMs: 50,
      workerFactory: () => worker,
      urlFactory: () => "blob:timeout",
      urlRevoke: () => undefined
    });

    const pending = runner.run("while (true) {}");
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toMatchObject({ exitCode: 124 });
    expect(worker.terminated).toBe(true);
    vi.useRealTimers();
  });

  it("returns a worker startup error and cleans up", async () => {
    const worker = new RespondingWorker();
    worker.postMessage = () => {
      queueMicrotask(() => worker.onerror?.(new ErrorEvent("error", { message: "worker failed" })));
    };
    const revoke = vi.fn();
    const runner = new BrowserJavaScriptRunner({
      workerFactory: () => worker,
      urlFactory: () => "blob:error",
      urlRevoke: revoke
    });

    await expect(runner.run("bad code")).resolves.toMatchObject({
      exitCode: 1,
      stderr: "worker failed"
    });
    expect(worker.terminated).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:error");
  });
});
