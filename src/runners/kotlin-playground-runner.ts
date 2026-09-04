import type { CodeRunner, RunContext, RunResult, RunnerAvailability } from "../contracts";
import { fetchWithTimeout, type FetchLike, unavailableFetch } from "./http-client";
import { ProviderUnavailableError, unknownRemoteFailure } from "./provider-errors";

const KOTLIN_API = "https://api.kotlinlang.org";

interface KotlinVersion {
  latestStable: boolean;
  version: string;
}

interface KotlinDiagnostic {
  message?: string;
  severity?: string;
}

interface KotlinRunResponse {
  errors?: Record<string, KotlinDiagnostic[]>;
  exception?: unknown;
  text?: string;
}

export class KotlinPlaygroundRunner implements CodeRunner {
  readonly environment = "remote" as const;
  readonly language = "kotlin";
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  #version: string | null = null;

  constructor(options: { fetch?: FetchLike; timeoutMs?: number } = {}) {
    this.#fetch = options.fetch ?? unavailableFetch;
    this.#timeoutMs = options.timeoutMs ?? 20_000;
  }

  async availability(): Promise<RunnerAvailability> {
    try {
      const response = await fetchWithTimeout(this.#fetch, `${KOTLIN_API}/versions`, {}, 5_000);
      if (!response.ok) return { available: false, detail: `Kotlin Playground HTTP ${String(response.status)}` };
      const versions = await response.json() as KotlinVersion[];
      this.#version = versions.find((version) => version.latestStable)?.version ?? null;
      return this.#version === null
        ? { available: false, detail: "Kotlin Playground stable compiler를 찾지 못했습니다." }
        : {
            available: true,
            detail: `Kotlin Playground ${this.#version}. 소스 코드가 api.kotlinlang.org로 전송됩니다.`
          };
    } catch (error) {
      return {
        available: false,
        detail: `Kotlin Playground preflight 실패: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async run(code: string, context?: RunContext): Promise<RunResult> {
    if (this.#version === null) {
      throw new ProviderUnavailableError("Kotlin Playground compiler version이 선택되지 않았습니다.", "not-started");
    }
    const started = performance.now();
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.#fetch,
        `${KOTLIN_API}/api/${encodeURIComponent(this.#version)}/compiler/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            args: "",
            confType: "java",
            files: [{ name: "File.kt", publicId: "", text: code }]
          })
        },
        this.#timeoutMs,
        context?.signal
      );
    } catch (error) {
      throw unknownRemoteFailure("Kotlin Playground", error);
    }
    if (!response.ok) {
      if ([401, 403, 404, 429].includes(response.status)) {
        throw new ProviderUnavailableError(`Kotlin Playground HTTP ${String(response.status)}`, "not-started");
      }
      throw new ProviderUnavailableError(`Kotlin Playground HTTP ${String(response.status)}`, "unknown");
    }
    const data = await response.json() as unknown;
    if (!isKotlinRunResponse(data)) {
      throw new ProviderUnavailableError("Kotlin Playground가 유효한 실행 결과를 반환하지 않았습니다.", "unknown");
    }
    const diagnostics = Object.values(data.errors ?? {}).flat();
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
    const stdout = streams(data.text ?? "", "outStream").join("");
    const remoteStderr = streams(data.text ?? "", "errStream").join("");
    const stderr = [
      ...errors.map((error) => error.message ?? "Kotlin compilation error"),
      remoteStderr,
      data.exception === null || data.exception === undefined ? "" : JSON.stringify(data.exception)
    ].filter(Boolean).join("\n");
    return {
      durationMs: performance.now() - started,
      environment: "remote",
      exitCode: errors.length === 0 && !stderr ? 0 : 1,
      provider: `Kotlin Playground · ${this.#version}`,
      stderr,
      stdout
    };
  }
}

function streams(text: string, tag: string): string[] {
  return [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gu"))]
    .map((match) => match[1] ?? "");
}

function isKotlinRunResponse(value: unknown): value is KotlinRunResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.text === "string" &&
    isKotlinDiagnostics(record.errors) &&
    Object.hasOwn(record, "exception");
}

function isKotlinDiagnostics(value: unknown): value is Record<string, KotlinDiagnostic[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((diagnostics) =>
    Array.isArray(diagnostics) && diagnostics.every((diagnostic) => {
      if (typeof diagnostic !== "object" || diagnostic === null || Array.isArray(diagnostic)) return false;
      const record = diagnostic as Record<string, unknown>;
      return (record.message === undefined || typeof record.message === "string") &&
        (record.severity === undefined || typeof record.severity === "string");
    })
  );
}
