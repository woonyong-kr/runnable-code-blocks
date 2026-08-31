import { getVersion, transform } from "sucrase";
import type { CodeRunner, RunResult } from "../contracts";
import { BrowserJavaScriptRunner } from "./javascript-runner";

export class BrowserTypeScriptRunner implements CodeRunner {
  readonly environment = "browser" as const;
  readonly language = "typescript";
  readonly #javascript: BrowserJavaScriptRunner;

  constructor(javascript = new BrowserJavaScriptRunner()) {
    this.#javascript = javascript;
  }

  async availability() {
    return await this.#javascript.availability();
  }

  async run(code: string): Promise<RunResult> {
    const started = performance.now();
    const provider = `Sucrase ${getVersion()} → Web Worker`;
    let javascript: string;
    try {
      javascript = transform(code, {
        disableESTransforms: true,
        production: true,
        transforms: ["typescript"]
      }).code;
    } catch (error) {
      return {
        durationMs: performance.now() - started,
        environment: "browser",
        exitCode: 1,
        provider,
        stderr: error instanceof Error ? error.message : String(error),
        stdout: ""
      };
    }
    const result = await this.#javascript.run(javascript);
    return {
      ...result,
      durationMs: performance.now() - started,
      environment: "browser",
      provider
    };
  }
}
