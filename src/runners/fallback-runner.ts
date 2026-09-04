import type { CodeRunner, RunContext, RunResult, RunnerAvailability, RunnerEnvironment } from "../contracts";
import { ProviderUnavailableError } from "./provider-errors";

export class FallbackRunner implements CodeRunner {
  readonly environment: RunnerEnvironment;
  readonly language: string;
  readonly #runners: readonly CodeRunner[];
  #selectedRunner: CodeRunner | null = null;

  constructor(language: string, runners: readonly CodeRunner[]) {
    if (runners.length === 0) throw new Error(`At least one runner is required for ${language}`);
    this.language = language;
    this.#runners = runners;
    this.environment = runners[0]?.environment ?? "browser";
  }

  async availability(): Promise<RunnerAvailability> {
    const unavailable: string[] = [];
    for (const runner of this.#runners) {
      try {
        const status = await runner.availability();
        if (status.available) {
          this.#selectedRunner = runner;
          return {
            available: true,
            detail: `${runner.environment}: ${status.detail}`
          };
        }
        unavailable.push(`${runner.environment}: ${status.detail}`);
      } catch (error) {
        unavailable.push(`${runner.environment}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.#selectedRunner = null;
    return { available: false, detail: unavailable.join(" / ") };
  }

  async run(code: string, context?: RunContext): Promise<RunResult> {
    const skipped: string[] = [];
    const selected = this.#selectedRunner;
    const candidates = selected === null
      ? this.#runners
      : [selected, ...this.#runners.filter((runner) => runner !== selected)];
    this.#selectedRunner = null;
    for (const runner of candidates) {
      if (runner !== selected) {
        let status: RunnerAvailability;
        try {
          status = await runner.availability();
        } catch (error) {
          skipped.push(`${runner.environment}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        if (!status.available) {
          skipped.push(`${runner.environment}: ${status.detail}`);
          continue;
        }
      }
      try {
        const result = await runner.run(code, context);
        return {
          ...result,
          environment: result.environment ?? runner.environment,
          provider: result.provider ?? runner.environment
        };
      } catch (error) {
        if (error instanceof ProviderUnavailableError && error.executionState === "not-started") {
          skipped.push(`${runner.environment}: ${error.message}`);
          continue;
        }
        throw error;
      }
    }
    throw new ProviderUnavailableError(
      `실행 가능한 provider가 없습니다. ${skipped.join(" / ")}`,
      "not-started"
    );
  }

  dispose(): void {
    this.#selectedRunner = null;
    for (const runner of this.#runners) runner.dispose?.();
  }
}
