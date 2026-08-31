import type { CodeRunner, RunResult, RunnerAvailability } from "../contracts";

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

const WORKER_SOURCE = String.raw`
const format = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const blocked = () => Promise.reject(new Error("Network access is disabled in runnable code blocks."));
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "WebTransport", "EventSource", "importScripts"]) {
  try { Object.defineProperty(globalThis, name, { configurable: false, value: blocked, writable: false }); } catch {}
}
self.onmessage = async (event) => {
  const { code, token } = event.data;
  const logs = [];
  const consoleProxy = {};
  for (const level of ["log", "info", "warn", "error"]) {
    consoleProxy[level] = (...values) => logs.push(values.map(format).join(" "));
  }
  const started = performance.now();
  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const value = await new AsyncFunction("console", '"use strict";\n' + code)(consoleProxy);
    if (typeof value !== "undefined") logs.push(format(value));
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
      : { available: true, detail: "Runs locally in an isolated Web Worker without a server." };
  }

  async run(code: string): Promise<RunResult> {
    if (/\bimport\s*\(/u.test(code)) {
      return {
        durationMs: 0,
        environment: "browser",
        exitCode: 1,
        provider: "Web Worker",
        stderr: "Dynamic import is disabled because it can bypass the browser runner's network boundary.",
        stdout: ""
      };
    }
    const token = globalThis.crypto.randomUUID();
    const url = this.#urlFactory(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = this.#workerFactory(url);
    return await new Promise<RunResult>((resolve) => {
      let settled = false;
      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        this.#urlRevoke(url);
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish({
          durationMs: this.#timeoutMs,
          exitCode: 124,
          stderr: `Execution exceeded ${String(this.#timeoutMs)} ms and was stopped.`,
          stdout: ""
        });
      }, this.#timeoutMs);
      worker.onerror = (event) => {
        finish({ durationMs: 0, exitCode: 1, stderr: event.message, stdout: "" });
      };
      worker.onmessage = ({ data }: MessageEvent<WorkerResultMessage>) => {
        if (data.token !== token) return;
        finish({
          durationMs: data.durationMs,
          exitCode: data.error === undefined ? 0 : 1,
          stderr: data.error ?? "",
          stdout: data.logs.join("\n")
        });
      };
      worker.postMessage({ code, token });
    });
  }
}
