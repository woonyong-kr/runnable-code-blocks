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
      environment: "browser",
      exitCode: 0,
      provider: "Web Worker",
      stderr: "",
      stdout: "2, 4, 6"
    });
    expect(worker.terminated).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:test-worker");
  });

  it("does not reject harmless strings that contain import syntax", async () => {
    const worker = new RespondingWorker();
    const workerFactory = vi.fn(() => worker);
    const runner = new BrowserJavaScriptRunner({
      workerFactory,
      urlFactory: () => "blob:string-literal",
      urlRevoke: () => undefined
    });

    await expect(runner.run('console.log("import(")')).resolves.toMatchObject({ exitCode: 0 });
    expect(workerFactory).toHaveBeenCalledOnce();
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

  it("revokes the Blob URL when worker construction fails", async () => {
    const revoke = vi.fn();
    const runner = new BrowserJavaScriptRunner({
      workerFactory: () => { throw new Error("constructor failed"); },
      urlFactory: () => "blob:constructor-error",
      urlRevoke: revoke
    });

    await expect(runner.run("code")).resolves.toMatchObject({ exitCode: 1, stderr: "constructor failed" });
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("terminates and revokes when postMessage fails", async () => {
    const worker = new RespondingWorker();
    worker.postMessage = () => { throw new Error("post failed"); };
    const revoke = vi.fn();
    const runner = new BrowserJavaScriptRunner({
      workerFactory: () => worker,
      urlFactory: () => "blob:post-error",
      urlRevoke: revoke
    });

    await expect(runner.run("code")).resolves.toMatchObject({ exitCode: 1, stderr: "post failed" });
    expect(worker.terminated).toBe(true);
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("cancels an active worker through both AbortSignal and runner disposal", async () => {
    const first = new RespondingWorker();
    first.postMessage = () => undefined;
    const second = new RespondingWorker();
    second.postMessage = () => undefined;
    const workers = [first, second];
    const runner = new BrowserJavaScriptRunner({
      workerFactory: () => workers.shift() ?? new RespondingWorker(),
      urlFactory: () => `blob:${String(workers.length)}`,
      urlRevoke: () => undefined
    });
    const controller = new AbortController();
    const aborted = runner.run("code", { signal: controller.signal });
    controller.abort();
    await expect(aborted).resolves.toMatchObject({ exitCode: 130 });
    expect(first.terminated).toBe(true);

    const disposed = runner.run("code");
    runner.dispose();
    await expect(disposed).resolves.toMatchObject({ exitCode: 130 });
    expect(second.terminated).toBe(true);
  });
});
