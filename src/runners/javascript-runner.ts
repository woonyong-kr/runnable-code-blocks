import type { CodeRunner, RunContext, RunResult, RunnerAvailability } from "../contracts";
import { OUTPUT_LIMITS } from "../output-buffer";

interface WorkerResultMessage {
  durationMs: number;
  error?: string;
  logs: string[];
  token: string;
}

export interface WorkerLike {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<WorkerResultMessage>) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export type WorkerFactory = (url: string) => WorkerLike;

const WORKER_RESULT_CONTEXT = {
  environment: "browser" as const,
  provider: "Web Worker"
};

const WORKER_SOURCE = String.raw`
const ENTRY_LIMIT = ${OUTPUT_LIMITS.entries};
const CHARACTER_LIMIT = ${OUTPUT_LIMITS.characters};
const TRUNCATED = ${JSON.stringify(OUTPUT_LIMITS.marker)};
const format = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const blocked = () => Promise.reject(new Error("This direct network API is disabled in runnable code blocks."));
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "WebTransport", "EventSource", "importScripts", "Worker", "SharedWorker"]) {
  try { Object.defineProperty(globalThis, name, { configurable: false, value: blocked, writable: false }); } catch {}
}
self.onmessage = async (event) => {
  const { code, token } = event.data;
  const logs = [];
  let characters = 0;
  let truncated = false;
  const append = (message) => {
    if (truncated) return;
    if (logs.length >= ENTRY_LIMIT || characters + message.length > CHARACTER_LIMIT) {
      logs.push(TRUNCATED);
      truncated = true;
      return;
    }
    logs.push(message);
    characters += message.length;
  };
  const consoleProxy = {};
  for (const level of ["log", "info", "warn", "error"]) {
    consoleProxy[level] = (...values) => append(values.map(format).join(" "));
  }
  const started = performance.now();
  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const value = await new AsyncFunction("console", '"use strict";\n' + code)(consoleProxy);
    if (typeof value !== "undefined") append(format(value));
    self.postMessage({ token, logs, durationMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ token, logs, error: error instanceof Error ? error.stack || error.message : String(error), durationMs: performance.now() - started });
  }
};
`;

export class BrowserJavaScriptRunner implements CodeRunner {
  readonly environment = "browser" as const;
  readonly language = "javascript";
  readonly #timeoutMs;
  readonly #workerFactory;
  readonly #urlFactory;
  readonly #urlRevoke;
  readonly #activeCancels = new Set<() => void>();

  constructor(options: {
    timeoutMs?: number;
    workerFactory?: WorkerFactory;
    urlFactory?: (blob: Blob) => string;
    urlRevoke?: (url: string) => void;
  } = {}) {
    this.#timeoutMs = options.timeoutMs ?? 5_000;
    this.#workerFactory = options.workerFactory ?? ((url) => new Worker(url));
    this.#urlFactory = options.urlFactory ?? ((blob) => URL.createObjectURL(blob));
    this.#urlRevoke = options.urlRevoke ?? ((url) => URL.revokeObjectURL(url));
  }

  async availability(): Promise<RunnerAvailability> {
    return typeof Worker === "undefined"
      ? { available: false, detail: "This environment does not provide Web Workers." }
      : {
          available: true,
          detail: "Runs trusted code locally in a disposable Web Worker with a five-second timeout."
        };
  }

  async run(code: string, context?: RunContext): Promise<RunResult> {
    if (context?.signal?.aborted === true) return cancelledResult();
    const token = window.crypto.randomUUID();
    const url = this.#urlFactory(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    return await new Promise<RunResult>((resolve) => {
      let settled = false;
      let worker: WorkerLike | null = null;
      let timer: number | null = null;
      let urlRevoked = false;
      const cleanup = () => {
        if (timer !== null) window.clearTimeout(timer);
        worker?.terminate();
        if (!urlRevoked) {
          urlRevoked = true;
          this.#urlRevoke(url);
        }
        context?.signal?.removeEventListener("abort", onAbort);
        this.#activeCancels.delete(onAbort);
      };
      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const onAbort = () => finish(cancelledResult());
      try {
        worker = this.#workerFactory(url);
      } catch (error) {
        cleanup();
        resolve({ ...WORKER_RESULT_CONTEXT, durationMs: 0, exitCode: 1, stderr: error instanceof Error ? error.message : String(error), stdout: "" });
        return;
      }
      this.#activeCancels.add(onAbort);
      context?.signal?.addEventListener("abort", onAbort, { once: true });
      timer = window.setTimeout(() => {
        finish({
          ...WORKER_RESULT_CONTEXT,
          durationMs: this.#timeoutMs,
          exitCode: 124,
          stderr: `Execution exceeded ${String(this.#timeoutMs)} ms and was stopped.`,
          stdout: ""
        });
      }, this.#timeoutMs);
      worker.onerror = (event) => {
        finish({ ...WORKER_RESULT_CONTEXT, durationMs: 0, exitCode: 1, stderr: event.message, stdout: "" });
      };
      worker.onmessage = ({ data }: MessageEvent<WorkerResultMessage>) => {
        if (data.token !== token) return;
        finish({
          ...WORKER_RESULT_CONTEXT,
          durationMs: data.durationMs,
          exitCode: data.error === undefined ? 0 : 1,
          stderr: data.error ?? "",
          stdout: data.logs.join("\n")
        });
      };
      try {
        worker.postMessage({ code, token });
      } catch (error) {
        finish({ ...WORKER_RESULT_CONTEXT, durationMs: 0, exitCode: 1, stderr: error instanceof Error ? error.message : String(error), stdout: "" });
      }
    });
  }

  dispose(): void {
    for (const cancel of [...this.#activeCancels]) cancel();
  }
}

function cancelledResult(): RunResult {
  return {
    ...WORKER_RESULT_CONTEXT,
    durationMs: 0,
    exitCode: 130,
    stderr: "Execution was cancelled.",
    stdout: ""
  };
}
