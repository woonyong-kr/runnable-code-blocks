import type { CodeRunner, RunContext, RunResult, RunnerAvailability } from "../contracts";
import { fetchWithTimeout, type FetchLike, unavailableFetch } from "./http-client";
import { ProviderUnavailableError, unknownRemoteFailure } from "./provider-errors";

const WANDBOX_API = "https://wandbox.org/api";
const CACHE_TTL_MS = 5 * 60_000;

interface WandboxCompiler {
  language: string;
  name: string;
  version: string;
}

interface WandboxResponse {
  compiler_error?: string;
  compiler_message?: string;
  compiler_output?: string;
  program_error?: string;
  program_output?: string;
  status?: string;
}

let compilerCache: { expiresAt: number; value: readonly WandboxCompiler[] } | null = null;
let compilerRequest: Promise<readonly WandboxCompiler[]> | null = null;

export class WandboxRunner implements CodeRunner {
  readonly environment = "remote" as const;
  readonly language: string;
  readonly #fetch: FetchLike;
  readonly #remoteLanguage: string;
  readonly #timeoutMs: number;
  #compiler: WandboxCompiler | null = null;

  constructor(options: {
    fetch?: FetchLike;
    language: string;
    remoteLanguage: string;
    timeoutMs?: number;
  }) {
    this.language = options.language;
    this.#remoteLanguage = options.remoteLanguage;
    this.#fetch = options.fetch ?? unavailableFetch;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async availability(): Promise<RunnerAvailability> {
    try {
      const compilers = await this.#compilerList();
      this.#compiler = selectCompiler(this.language, this.#remoteLanguage, compilers);
      return this.#compiler === null
        ? { available: false, detail: `Wandbox에 ${this.#remoteLanguage} compiler가 없습니다.` }
        : {
            available: true,
            detail: `Wandbox ${this.#compiler.name}. 소스 코드가 wandbox.org로 전송됩니다.`
          };
    } catch (error) {
      return {
        available: false,
        detail: `Wandbox preflight 실패: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async run(code: string, context?: RunContext): Promise<RunResult> {
    if (this.#compiler === null) {
      throw new ProviderUnavailableError("Wandbox preflight에서 compiler를 선택하지 못했습니다.", "not-started");
    }
    const started = performance.now();
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.#fetch,
        `${WANDBOX_API}/compile.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ compiler: this.#compiler.name, code, save: false })
        },
        this.#timeoutMs,
        context?.signal
      );
    } catch (error) {
      throw unknownRemoteFailure("Wandbox", error);
    }
    if (!response.ok) {
      const message = `Wandbox HTTP ${String(response.status)}`;
      if ([401, 403, 404, 429].includes(response.status)) {
        throw new ProviderUnavailableError(message, "not-started");
      }
      throw new ProviderUnavailableError(message, "unknown");
    }
    const data = await response.json() as unknown;
    if (!isWandboxResponse(data)) {
      throw new ProviderUnavailableError("Wandbox가 유효한 실행 결과를 반환하지 않았습니다.", "unknown");
    }
    if (isInfrastructureRejection(data)) {
      throw new ProviderUnavailableError(
        `Wandbox container가 실행 전에 거절되었습니다: ${data.program_error || data.compiler_error || "infrastructure unavailable"}`,
        "not-started"
      );
    }
    const stdout = data.program_output ?? "";
    const stderr = [data.compiler_error, data.compiler_output, data.program_error]
      .filter((value): value is string => Boolean(value))
      .join("\n");
    const parsedStatus = Number(data.status);
    return {
      durationMs: performance.now() - started,
      environment: "remote",
      exitCode: Number.isFinite(parsedStatus) ? parsedStatus : 1,
      provider: `Wandbox · ${this.#compiler.name}`,
      stderr,
      stdout
    };
  }

  async #compilerList(): Promise<readonly WandboxCompiler[]> {
    const now = Date.now();
    if (compilerCache !== null && compilerCache.expiresAt > now) return compilerCache.value;
    compilerRequest ??= this.#fetchCompilerList(now);
    try {
      return await compilerRequest;
    } finally {
      compilerRequest = null;
    }
  }

  async #fetchCompilerList(now: number): Promise<readonly WandboxCompiler[]> {
    const response = await fetchWithTimeout(this.#fetch, `${WANDBOX_API}/list.json`, {}, 5_000);
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const value = await response.json() as WandboxCompiler[];
    compilerCache = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  }
}

function isInfrastructureRejection(data: WandboxResponse): boolean {
  const detail = `${data.compiler_error ?? ""}\n${data.program_error ?? ""}`;
  return data.status === "126" && /OCI runtime error|Resource temporarily unavailable/iu.test(detail);
}

function isWandboxResponse(value: unknown): value is WandboxResponse & { status: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.status !== "string" || !/^-?\d+$/u.test(record.status.trim())) return false;
  return ["compiler_error", "compiler_message", "compiler_output", "program_error", "program_output"]
    .every((field) => record[field] === undefined || typeof record[field] === "string");
}

export function resetWandboxCompilerCache(): void {
  compilerCache = null;
  compilerRequest = null;
}

function selectCompiler(
  language: string,
  remoteLanguage: string,
  compilers: readonly WandboxCompiler[]
): WandboxCompiler | null {
  const candidates = compilers.filter((compiler) => compiler.language === remoteLanguage);
  const prefixes: Record<string, readonly string[]> = {
    c: ["gcc-", "clang-"],
    cpp: ["gcc-", "clang-"],
    csharp: ["mono-", "dotnetcore-"],
    javascript: ["nodejs-"],
    python: ["cpython-3."],
    shell: ["bash"],
    sql: ["sqlite-"],
    scala: ["scala-3.3.", "scala-2.13.", "scala-"],
    typescript: ["typescript-"]
  };
  for (const prefix of prefixes[language] ?? []) {
    const stable = candidates.find((candidate) => candidate.name.startsWith(prefix) && !candidate.name.includes("head"));
    if (stable !== undefined) return stable;
  }
  return candidates.find((candidate) => !candidate.name.includes("head")) ?? candidates[0] ?? null;
}
