import ts from "typescript";
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
    const transpiled = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
        strict: true
      },
      reportDiagnostics: true
    });
    const errors = (transpiled.diagnostics ?? [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    if (errors.length > 0) {
      return {
        durationMs: performance.now() - started,
        environment: "browser",
        exitCode: 1,
        provider: `TypeScript ${ts.version} → Web Worker`,
        stderr: errors.join("\n"),
        stdout: ""
      };
    }
    const result = await this.#javascript.run(transpiled.outputText);
    return {
      ...result,
      durationMs: performance.now() - started,
      environment: "browser",
      provider: `TypeScript ${ts.version} → Web Worker`
    };
  }
}
