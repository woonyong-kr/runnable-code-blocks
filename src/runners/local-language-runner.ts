import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeRunner, RunResult, RunnerAvailability } from "../contracts";
import { NodeCommandExecutor, type CommandExecutor } from "./local-command";
import { ProviderUnavailableError } from "./provider-errors";

interface ToolSpec {
  candidates: readonly string[];
  key: string;
  versionArguments: readonly string[];
}

interface CommandStep {
  arguments: string[];
  command?: string;
  commandKey?: string;
  stdin?: string;
  timeoutMs: number;
}

interface LocalLanguageSpec {
  files(code: string, toolVersions: ReadonlyMap<string, string>): Record<string, string>;
  steps(code: string, workspace: string): CommandStep[];
  tools: readonly ToolSpec[];
}

export interface LocalLanguageRunnerOptions {
  executor?: CommandExecutor;
  executableOverrides?: Record<string, string>;
  language: string;
}

export class LocalLanguageRunner implements CodeRunner {
  readonly environment = "local" as const;
  readonly language: string;
  readonly #executor: CommandExecutor;
  readonly #overrides: Record<string, string>;
  readonly #spec: LocalLanguageSpec | null;
  readonly #resolved = new Map<string, string>();
  readonly #toolVersions = new Map<string, string>();

  constructor(options: LocalLanguageRunnerOptions) {
    this.language = options.language;
    this.#executor = options.executor ?? new NodeCommandExecutor();
    this.#overrides = options.executableOverrides ?? {};
    this.#spec = LOCAL_LANGUAGE_SPECS[options.language] ?? null;
  }

  async availability(): Promise<RunnerAvailability> {
    if (this.#spec === null) return { available: false, detail: `${this.language} local adapter가 없습니다.` };
    this.#resolved.clear();
    this.#toolVersions.clear();
    for (const tool of this.#spec.tools) {
      const override = this.#overrides[tool.key]?.trim();
      const candidates = override ? [override] : tool.candidates;
      let found: string | null = null;
      let foundVersion = "";
      for (const candidate of candidates) {
        const result = await this.#executor.execute(candidate, [...tool.versionArguments], 3_000);
        if (result.exitCode === 0) {
          found = candidate;
          foundVersion = `${result.stdout}\n${result.stderr}`.trim();
          break;
        }
      }
      if (found === null) {
        return {
          available: false,
          detail: override
            ? `${tool.key} executable을 ${override}에서 찾지 못했습니다.`
            : `${tool.key} executable을 PATH에서 찾지 못했습니다. plugin은 runtime을 자동 설치하지 않습니다.`
        };
      }
      this.#resolved.set(tool.key, found);
      this.#toolVersions.set(tool.key, foundVersion);
    }
    return {
      available: true,
      detail: `Local ${this.language}: ${[...this.#resolved.values()].join(", ")}. 임시 폴더에서 실행하지만 OS sandbox는 아닙니다.`
    };
  }

  async run(code: string): Promise<RunResult> {
    if (this.#spec === null || this.#resolved.size !== this.#spec.tools.length) {
      throw new ProviderUnavailableError(`${this.language} local toolchain preflight가 완료되지 않았습니다.`, "not-started");
    }
    const started = performance.now();
    const workspace = await mkdtemp(join(tmpdir(), `runnable-code-blocks-${this.language}-`));
    try {
      for (const [file, contents] of Object.entries(this.#spec.files(code, this.#toolVersions))) {
        await writeFile(join(workspace, file), contents, { encoding: "utf8", mode: 0o600 });
      }
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      for (const step of this.#spec.steps(code, workspace)) {
        const command = step.command ?? (step.commandKey === undefined ? undefined : this.#resolved.get(step.commandKey));
        if (command === undefined) {
          throw new ProviderUnavailableError(`${step.commandKey ?? "local"} executable이 해석되지 않았습니다.`, "not-started");
        }
        const result = await this.#executor.execute(command, step.arguments, step.timeoutMs, {
          cwd: workspace,
          stdin: step.stdin
        });
        stdout += result.stdout;
        stderr += result.stderr;
        exitCode = result.exitCode;
        if (exitCode !== 0) break;
      }
      return {
        durationMs: performance.now() - started,
        environment: "local",
        exitCode,
        provider: `Local · ${[...this.#resolved.values()].join(" + ")}`,
        stderr,
        stdout
      };
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  }
}

const source = (file: string) => (code: string) => ({ [file]: code });
const interpreted = (
  file: string,
  key: string,
  candidates: readonly string[],
  versionArguments: readonly string[] = ["--version"]
): LocalLanguageSpec => ({
  files: source(file),
  steps: (_code, workspace) => [{ arguments: [join(workspace, file)], commandKey: key, timeoutMs: 5_000 }],
  tools: [{ candidates, key, versionArguments }]
});

export const LOCAL_LANGUAGE_SPECS: Readonly<Record<string, LocalLanguageSpec>> = {
  javascript: interpreted("Main.js", "node", ["node"]),
  python: interpreted("Main.py", "python", ["python3", "python"]),
  ruby: interpreted("Main.rb", "ruby", ["ruby"]),
  php: interpreted("Main.php", "php", ["php"]),
  r: interpreted("Main.R", "Rscript", ["Rscript"]),
  swift: interpreted("Main.swift", "swift", ["swift"]),
  scala: interpreted("Main.scala", "scala", ["scala"], ["-version"]),
  dart: interpreted("Main.dart", "dart", ["dart"]),
  lua: interpreted("Main.lua", "lua", ["lua"], ["-v"]),
  shell: interpreted("Main.sh", "shell", ["/bin/sh"], ["--version"]),
  sql: {
    files: source("Main.sql"),
    steps: (code) => [{ arguments: [":memory:"], commandKey: "sqlite3", stdin: code, timeoutMs: 5_000 }],
    tools: [{ candidates: ["sqlite3"], key: "sqlite3", versionArguments: ["--version"] }]
  },
  kotlin: {
    files: source("Main.kt"),
    steps: (_code, workspace) => [
      { arguments: [join(workspace, "Main.kt"), "-include-runtime", "-d", join(workspace, "program.jar")], commandKey: "kotlinc", timeoutMs: 20_000 },
      { arguments: ["-jar", join(workspace, "program.jar")], commandKey: "java", timeoutMs: 5_000 }
    ],
    tools: [
      {
        candidates: [
          join(homedir(), ".local", "share", "runnable-code-blocks", "kotlin", "current", "bin", "kotlinc"),
          "/opt/homebrew/bin/kotlinc",
          "/usr/local/bin/kotlinc",
          "kotlinc"
        ],
        key: "kotlinc",
        versionArguments: ["-version"]
      },
      { candidates: ["java"], key: "java", versionArguments: ["-version"] }
    ]
  },
  java: {
    files: source("Main.java"),
    steps: (_code, workspace) => [
      { arguments: [join(workspace, "Main.java")], commandKey: "javac", timeoutMs: 15_000 },
      { arguments: ["-cp", workspace, "Main"], commandKey: "java", timeoutMs: 5_000 }
    ],
    tools: [
      { candidates: ["javac"], key: "javac", versionArguments: ["-version"] },
      { candidates: ["java"], key: "java", versionArguments: ["-version"] }
    ]
  },
  c: compiledSpec("Main.c", "cc", ["clang", "gcc"]),
  cpp: compiledSpec("Main.cpp", "cxx", ["clang++", "g++"]),
  rust: compiledSpec("Main.rs", "rustc", ["rustc"]),
  go: {
    files: source("Main.go"),
    steps: (_code, workspace) => [{ arguments: ["run", join(workspace, "Main.go")], commandKey: "go", timeoutMs: 10_000 }],
    tools: [{ candidates: ["go"], key: "go", versionArguments: ["version"] }]
  },
  csharp: {
    files: (code, toolVersions) => ({
      "Program.cs": code,
      "RunnableCodeBlocks.csproj": `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${dotnetTargetFramework(toolVersions.get("dotnet") ?? "")}</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>`
    }),
    steps: (_code, workspace) => [{
      arguments: ["run", "--project", join(workspace, "RunnableCodeBlocks.csproj"), "--nologo", "--verbosity", "quiet"],
      commandKey: "dotnet",
      timeoutMs: 20_000
    }],
    tools: [{ candidates: ["dotnet"], key: "dotnet", versionArguments: ["--version"] }]
  }
};

export function dotnetTargetFramework(versionText: string): string {
  const major = versionText.match(/(?:^|\s)(\d+)\.\d+/u)?.[1];
  return major === undefined ? "net8.0" : `net${major}.0`;
}

function compiledSpec(file: string, key: string, candidates: readonly string[]): LocalLanguageSpec {
  return {
    files: source(file),
    steps: (_code, workspace) => [
      { arguments: [join(workspace, file), "-o", join(workspace, "program")], commandKey: key, timeoutMs: 15_000 },
      { arguments: [], command: join(workspace, "program"), timeoutMs: 5_000 }
    ],
    tools: [{ candidates, key, versionArguments: ["--version"] }]
  };
}
