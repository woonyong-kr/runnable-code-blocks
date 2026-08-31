import { spawn } from "node:child_process";
import type { SpawnOptionsWithoutStdio } from "node:child_process";

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface CommandOptions {
  cwd?: string;
  stdin?: string;
}

export interface CommandExecutor {
  execute(
    command: string,
    arguments_: string[],
    timeoutMs: number,
    options?: CommandOptions
  ): Promise<CommandResult>;
}

export class NodeCommandExecutor implements CommandExecutor {
  readonly #maxBuffer: number;

  constructor(maxBuffer = 1_048_576) {
    this.#maxBuffer = maxBuffer;
  }

  async execute(
    command: string,
    arguments_: string[],
    timeoutMs: number,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    return await new Promise((resolve) => {
      const spawnOptions: SpawnOptionsWithoutStdio = {
        cwd: options.cwd,
        env: { ...process.env, NO_COLOR: "1" },
        shell: false,
        windowsHide: true
      };
      const child = spawn(command, arguments_, spawnOptions);
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let bytes = 0;
      let settled = false;
      let timedOut = false;
      let overflow = false;
      const finish = (result: CommandResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const collect = (target: Buffer[], chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > this.#maxBuffer) {
          overflow = true;
          child.kill("SIGKILL");
          return;
        }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
      child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
      child.on("error", (error) => finish({ exitCode: 127, stderr: error.message, stdout: "" }));
      child.on("close", (code) => finish({
        exitCode: overflow ? 125 : timedOut ? 124 : code ?? 1,
        stderr: overflow
          ? `Output exceeded ${String(this.#maxBuffer)} bytes and the process was stopped.`
          : timedOut
            ? `Execution exceeded ${String(timeoutMs)} ms and the process was stopped.`
            : Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8")
      }));
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      if (options.stdin !== undefined) child.stdin.end(options.stdin);
      else child.stdin.end();
    });
  }
}
