import type { CodeRunner, RunResult, RunnerAvailability } from "../contracts";
import { fetchWithTimeout, type FetchLike } from "./http-client";
import { ProviderUnavailableError } from "./provider-errors";

const DARTPAD_API = "https://stable.api.dartpad.dev";
const DARTPAD_EMBED = "https://dartpad.dev/?embed=true&run=true&theme=dark";

interface DartPadVersion {
  dartVersion?: string;
}

export class DartPadRunner implements CodeRunner {
  readonly environment = "remote" as const;
  readonly language = "dart";
  readonly #fetch: FetchLike;
  #version = "current";

  constructor(options: { fetch?: FetchLike } = {}) {
    this.#fetch = options.fetch ?? fetch;
  }

  async availability(): Promise<RunnerAvailability> {
    try {
      const response = await fetchWithTimeout(this.#fetch, `${DARTPAD_API}/api/v3/version`, {}, 5_000);
      if (!response.ok) return { available: false, detail: `DartPad HTTP ${String(response.status)}` };
      const data = await response.json() as DartPadVersion;
      this.#version = data.dartVersion ?? "current";
      return {
        available: true,
        detail: `DartPad ${this.#version} embed. 소스 코드가 dartpad.dev로 전송됩니다.`
      };
    } catch (error) {
      return { available: false, detail: `DartPad preflight 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async run(code: string): Promise<RunResult> {
    if (typeof document === "undefined") {
      throw new ProviderUnavailableError("DartPad embed에는 DOM이 필요합니다.", "not-started");
    }
    return {
      durationMs: 0,
      environment: "remote",
      exitCode: 0,
      provider: `DartPad · ${this.#version}`,
      preview: {
        kind: "remote-iframe",
        postMessage: { sourceCode: code, type: "sourceCode" },
        src: DARTPAD_EMBED
      },
      stderr: "",
      stdout: "DartPad에서 실행합니다. 결과는 아래 격리된 embed에 표시됩니다."
    };
  }
}
