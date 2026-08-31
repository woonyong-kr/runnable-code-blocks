import type { CodeRunner, RunResult, RunnerAvailability } from "../contracts";
import { fetchWithTimeout, type FetchLike } from "./http-client";
import { ProviderUnavailableError } from "./provider-errors";
import { DART_DONE_MARKER, DART_ERROR_MARKER, instrumentDartSource } from "./dart-source-instrumentation";

const DARTPAD_API = "https://stable.api.dartpad.dev";
const DARTPAD_FRAME = "https://dartpad.dev/frame.html";

interface DartPadVersion {
  dartVersion?: string;
}

interface DartPadCompileResponse {
  result?: string;
}

export interface DartFrameExecution {
  durationMs: number;
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface DartFrameExecutor {
  execute(compiledJavaScript: string, timeoutMs: number): Promise<DartFrameExecution>;
}

export class DartPadRunner implements CodeRunner {
  readonly environment = "remote" as const;
  readonly language = "dart";
  readonly #executor: DartFrameExecutor | null;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  #version: string | null = null;

  constructor(options: {
    executor?: DartFrameExecutor;
    fetch?: FetchLike;
    timeoutMs?: number;
  } = {}) {
    this.#executor = options.executor ?? null;
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  async availability(): Promise<RunnerAvailability> {
    if (this.#executor === null && typeof document === "undefined") {
      return { available: false, detail: "DartPad browser execution에는 DOM이 필요합니다." };
    }
    try {
      const response = await fetchWithTimeout(this.#fetch, `${DARTPAD_API}/api/v3/version`, {}, 5_000);
      if (!response.ok) return { available: false, detail: `DartPad HTTP ${String(response.status)}` };
      const data = await response.json() as DartPadVersion;
      this.#version = data.dartVersion ?? "current";
      return {
        available: true,
        detail: `DartPad ${this.#version} compile API. 소스 코드가 stable.api.dartpad.dev로 전송되고 컴파일된 JavaScript는 격리된 frame에서 실행됩니다.`
      };
    } catch (error) {
      return { available: false, detail: `DartPad preflight 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async run(code: string): Promise<RunResult> {
    if (this.#version === null) {
      throw new ProviderUnavailableError("DartPad preflight가 완료되지 않았습니다.", "not-started");
    }
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.#fetch,
        `${DARTPAD_API}/api/v3/compileNewDDC`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deltaDill: null, source: instrumentDartSource(code) })
        },
        this.#timeoutMs
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ProviderUnavailableError(`DartPad compile 요청 실패: ${detail}`, "not-started");
    }
    if (!response.ok) {
      const detail = (await response.text()).trim() || `HTTP ${String(response.status)}`;
      if (response.status === 400) {
        return {
          durationMs: 0,
          environment: "remote",
          exitCode: 1,
          provider: `DartPad · ${this.#version}`,
          stderr: detail,
          stdout: ""
        };
      }
      throw new ProviderUnavailableError(`DartPad compile API: ${detail}`, "not-started");
    }
    const data = await response.json() as DartPadCompileResponse;
    if (typeof data.result !== "string" || !data.result) {
      throw new ProviderUnavailableError("DartPad compile API가 JavaScript를 반환하지 않았습니다.", "not-started");
    }
    const executor = this.#executor ?? new DartPadFrameExecutor();
    const result = await executor.execute(data.result, this.#timeoutMs);
    return {
      ...result,
      environment: "remote",
      provider: `DartPad · ${this.#version} → isolated frame`
    };
  }
}

export class DartPadFrameExecutor implements DartFrameExecutor {
  readonly #frameUrl: string;

  constructor(frameUrl = DARTPAD_FRAME) {
    this.#frameUrl = frameUrl;
  }

  async execute(compiledJavaScript: string, timeoutMs: number): Promise<DartFrameExecution> {
    if (typeof document === "undefined" || typeof window === "undefined") {
      throw new ProviderUnavailableError("DartPad browser frame에는 DOM이 필요합니다.", "not-started");
    }
    const started = performance.now();
    const frame = document.createElement("iframe");
    frame.className = "rcb__dart-execution-frame";
    frame.title = "Isolated Dart execution frame";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.src = this.#frameUrl;

    return await new Promise<DartFrameExecution>((resolve, reject) => {
      let executionStarted = false;
      let settled = false;
      const stdout: string[] = [];
      const stderr: string[] = [];
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        frame.remove();
      };
      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          durationMs: performance.now() - started,
          exitCode,
          stderr: stderr.join("\n"),
          stdout: stdout.join("\n")
        });
      };
      const failBeforeExecution = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new ProviderUnavailableError(message, "not-started"));
      };
      const onMessage = (event: MessageEvent<unknown>) => {
        if (event.source !== frame.contentWindow || event.origin !== "null") return;
        if (typeof event.data !== "object" || event.data === null) return;
        const data = event.data as Record<string, unknown>;
        if (data.sender !== "frame" || typeof data.type !== "string") return;
        if (data.type === "ready") {
          executionStarted = true;
          frame.contentWindow?.postMessage({
            command: "execute",
            js: decorateDartJavaScript(compiledJavaScript)
          }, "*");
          return;
        }
        if (typeof data.message === "string") {
          if (data.type === "stdout") stdout.push(data.message);
          if (data.type === "stderr" || data.type === "jserr") stderr.push(data.message);
        }
        if (data.type === "rcb-done") finish(stderr.length === 0 ? 0 : 1);
      };
      const timer = setTimeout(() => {
        if (!executionStarted) {
          failBeforeExecution(`DartPad execution frame이 ${String(timeoutMs)} ms 안에 준비되지 않았습니다.`);
          return;
        }
        stderr.push(`Dart browser execution exceeded ${String(timeoutMs)} ms and was stopped.`);
        finish(124);
      }, timeoutMs);
      frame.addEventListener("error", () => {
        if (!executionStarted) failBeforeExecution("DartPad execution frame을 불러오지 못했습니다.");
      }, { once: true });
      window.addEventListener("message", onMessage);
      document.body.append(frame);
    });
  }
}

export function decorateDartJavaScript(compiledJavaScript: string): string {
  return `
function dartPrint(message) {
  const text = message.toString();
  if (text === "${DART_DONE_MARKER}") {
    parent.postMessage({ sender: "frame", type: "rcb-done" }, "*");
  } else if (text.startsWith("${DART_ERROR_MARKER}")) {
    parent.postMessage({ sender: "frame", type: "jserr", message: text.slice(${String(DART_ERROR_MARKER.length)}) }, "*");
  } else {
    parent.postMessage({ sender: "frame", type: "stdout", message: text }, "*");
  }
}
window.onerror = function(message, url, line, column, error) {
  parent.postMessage({ sender: "frame", type: "jserr", message: String(error || message) }, "*");
  parent.postMessage({ sender: "frame", type: "rcb-done" }, "*");
};
require.config({
  baseUrl: "${DARTPAD_API}/artifacts/",
  waitSeconds: 60,
  onNodeCreated: function(node) { node.setAttribute("crossorigin", "anonymous"); }
});
{
  let __rcbDdcInit = function() { ${compiledJavaScript} };
  function __rcbContextLoaded() {
    __rcbDdcInit();
    try {
      dartDevEmbedder.runMain("package:dartpad_sample/bootstrap.dart", {});
    } catch (error) {
      parent.postMessage({ sender: "frame", type: "jserr", message: String(error) }, "*");
      parent.postMessage({ sender: "frame", type: "rcb-done" }, "*");
    }
  }
  function __rcbModuleLoaderLoaded() { require(["dart_sdk_new"], __rcbContextLoaded); }
  require(["ddc_module_loader"], __rcbModuleLoaderLoaded);
}
`;
}
