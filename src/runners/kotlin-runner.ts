import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeRunner, RunResult, RunnerAvailability } from "../contracts";

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface CommandExecutor {
  execute(command: string, arguments_: string[], timeoutMs: number): Promise<CommandResult>;
}

export class NodeCommandExecutor implements CommandExecutor {
  async execute(command: string, arguments_: string[], timeoutMs: number): Promise<CommandResult> {
    return await new Promise((resolve) => {
      execFile(
        command,
        arguments_,
        { encoding: "utf8", maxBuffer: 1_048_576, timeout: timeoutMs, windowsHide: true },
        (error, stdout, stderr) => {
          const exitCode = typeof error?.code === "number" ? error.code : error === null ? 0 : 1;
          resolve({ exitCode, stderr, stdout });
        }
      );
    });
  }
}

export interface KotlinRunnerOptions {
  compileTimeoutMs?: number;
  compilerPath?: string;
  executor?: CommandExecutor;
  javaPath?: string;
  runTimeoutMs?: number;
}

export class LocalKotlinRunner implements CodeRunner {
  readonly environment = "local" as const;
  readonly language = "kotlin";
  readonly #compileTimeoutMs;
  readonly #configuredCompilerPath;
  readonly #executor;
  readonly #javaPath;
  readonly #runTimeoutMs;
  #resolvedCompilerPath: string | null = null;

  constructor(options: KotlinRunnerOptions = {}) {
    this.#configuredCompilerPath = options.compilerPath?.trim() || null;
    this.#javaPath = options.javaPath?.trim() || "java";
    this.#compileTimeoutMs = options.compileTimeoutMs ?? 20_000;
    this.#runTimeoutMs = options.runTimeoutMs ?? 5_000;
    this.#executor = options.executor ?? new NodeCommandExecutor();
  }

  async availability(): Promise<RunnerAvailability> {
    const candidates = this.#configuredCompilerPath === null
      ? [
          join(homedir(), ".local", "share", "runnable-code-blocks", "kotlin", "current", "bin", "kotlinc"),
          "/opt/homebrew/bin/kotlinc",
          "/usr/local/bin/kotlinc",
          "kotlinc"
        ]
      : [this.#configuredCompilerPath];
    for (const candidate of candidates) {
      const compiler = await this.#executor.execute(candidate, ["-version"], 3_000);
      if (compiler.exitCode === 0) {
        this.#resolvedCompilerPath = candidate;
        break;
      }
    }
    if (this.#resolvedCompilerPath === null) {
      return {
        available: false,
        detail: this.#configuredCompilerPath === null
          ? "Kotlin compiler was not found. Configure kotlinc in plugin settings."
          : `Kotlin compiler was not found at ${this.#configuredCompilerPath}. Configure kotlinc in plugin settings.`
      };
    }
    const java = await this.#executor.execute(this.#javaPath, ["-version"], 3_000);
    return java.exitCode === 0
      ? { available: true, detail: "Runs with local kotlinc and java. No execution server is used." }
      : { available: false, detail: `Java was not found at ${this.#javaPath}.` };
  }

  async run(code: string): Promise<RunResult> {
    const started = performance.now();
    const workspace = await mkdtemp(join(tmpdir(), "runnable-code-blocks-"));
    const sourcePath = join(workspace, "Main.kt");
    const jarPath = join(workspace, "program.jar");
    try {
      await writeFile(sourcePath, code, { encoding: "utf8", mode: 0o600 });
      const compiled = await this.#executor.execute(
        this.#resolvedCompilerPath ?? this.#configuredCompilerPath ?? "kotlinc",
        [sourcePath, "-include-runtime", "-d", jarPath],
        this.#compileTimeoutMs
      );
      if (compiled.exitCode !== 0) {
        return {
          durationMs: performance.now() - started,
          exitCode: compiled.exitCode,
          stderr: compiled.stderr || compiled.stdout,
          stdout: ""
        };
      }
      const executed = await this.#executor.execute(
        this.#javaPath,
        ["-jar", jarPath],
        this.#runTimeoutMs
      );
      return { ...executed, durationMs: performance.now() - started };
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  }
}
