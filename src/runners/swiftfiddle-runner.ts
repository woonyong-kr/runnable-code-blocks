import type { CodeRunner, RunContext, RunResult, RunnerAvailability } from "../contracts";
import { fetchWithTimeout, type FetchLike, unavailableFetch } from "./http-client";
import { ProviderUnavailableError, unknownRemoteFailure } from "./provider-errors";

const SWIFT_VERSION = "6.3.1";
const SWIFT_RUNNER = `https://runner.swift-playground.com/runner/${SWIFT_VERSION}/run`;

interface SwiftFiddleEvent {
  kind?: string;
  text?: string;
}

export class SwiftFiddleRunner implements CodeRunner {
  readonly environment = "remote" as const;
  readonly language = "swift";
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(options: { fetch?: FetchLike; timeoutMs?: number } = {}) {
    this.#fetch = options.fetch ?? unavailableFetch;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async availability(): Promise<RunnerAvailability> {
    try {
      const response = await fetchWithTimeout(this.#fetch, SWIFT_RUNNER, { method: "OPTIONS" }, 5_000);
      return response.ok
        ? { available: true, detail: `SwiftFiddle ${SWIFT_VERSION}. 소스 코드가 runner.swift-playground.com으로 전송됩니다.` }
        : { available: false, detail: `SwiftFiddle HTTP ${String(response.status)}` };
    } catch (error) {
      return { available: false, detail: `SwiftFiddle preflight 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async run(code: string, context?: RunContext): Promise<RunResult> {
    const started = performance.now();
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.#fetch,
        SWIFT_RUNNER,
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            _color: false,
            _nonce: crypto.randomUUID(),
            _streaming: true,
            code,
            toolchain_version: SWIFT_VERSION
          })
        },
        this.#timeoutMs,
        context?.signal
      );
    } catch (error) {
      throw unknownRemoteFailure("SwiftFiddle", error);
    }
    if (!response.ok) {
      if ([401, 403, 404, 429].includes(response.status)) {
        throw new ProviderUnavailableError(`SwiftFiddle HTTP ${String(response.status)}`, "not-started");
      }
      throw new ProviderUnavailableError(`SwiftFiddle HTTP ${String(response.status)}`, "unknown");
    }
    const events = decodeSwiftFiddleEvents(await response.text());
    const stdout = events.filter(({ kind }) => kind === "stdout").map(({ text }) => text ?? "").join("");
    const stderr = events.filter(({ kind }) => kind === "stderr").map(({ text }) => text ?? "").join("");
    const version = events.find(({ kind }) => kind === "version")?.text?.split("\n")[0] ?? `Swift ${SWIFT_VERSION}`;
    return {
      durationMs: performance.now() - started,
      environment: "remote",
      exitCode: stderr ? 1 : 0,
      provider: `SwiftFiddle · ${version}`,
      stderr,
      stdout
    };
  }
}

function decodeSwiftFiddleEvents(body: string): SwiftFiddleEvent[] {
  const lines = body.split("\n").filter(Boolean);
  if (lines.length === 0) {
    throw new ProviderUnavailableError("SwiftFiddle가 유효한 실행 결과를 반환하지 않았습니다.", "unknown");
  }
  try {
    const events = lines.map((line) => JSON.parse(line) as unknown);
    if (!events.every(isSwiftFiddleEvent)) throw new Error("invalid event");
    return events;
  } catch {
    throw new ProviderUnavailableError("SwiftFiddle가 유효한 실행 결과를 반환하지 않았습니다.", "unknown");
  }
}

function isSwiftFiddleEvent(value: unknown): value is SwiftFiddleEvent {
  if (typeof value !== "object" || value === null) return false;
  const { kind, text } = value as Record<string, unknown>;
  return (kind === "stdout" || kind === "stderr" || kind === "version") && typeof text === "string";
}
