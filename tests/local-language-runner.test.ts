import { describe, expect, it } from "vitest";
import { dotnetTargetFramework, LocalLanguageRunner } from "../src/runners/local-language-runner";
import {
  NodeCommandExecutor,
  type CommandExecutor,
  type CommandOptions,
  type CommandResult
} from "../src/runners/local-command";

class FakeExecutor implements CommandExecutor {
  readonly calls: Array<{ arguments_: string[]; command: string; options?: CommandOptions; timeoutMs: number }> = [];
  readonly #results: CommandResult[];

  constructor(results: CommandResult[]) {
    this.#results = [...results];
  }

  async execute(
    command: string,
    arguments_: string[],
    timeoutMs: number,
    options?: CommandOptions
  ): Promise<CommandResult> {
    this.calls.push({ arguments_, command, options, timeoutMs });
    return this.#results.shift() ?? { exitCode: 0, stderr: "", stdout: "" };
  }
}

describe("LocalLanguageRunner", () => {
  it("targets the installed .NET SDK major version", () => {
    expect(dotnetTargetFramework("9.0.305")).toBe("net9.0");
    expect(dotnetTargetFramework("dotnet 10.0.100 preview")).toBe("net10.0");
    expect(dotnetTargetFramework("unknown")).toBe("net8.0");
  });

  it("captures output from the real local command wrapper", async () => {
    const result = await new NodeCommandExecutor().execute(
      process.execPath,
      ["-e", "process.stdout.write('wrapper-ok')"],
      3_000
    );
    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "wrapper-ok" });
  });

  it("resolves configured Kotlin tools without changing PATH", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "kotlinc-jvm 2.x", stdout: "" },
      { exitCode: 0, stderr: "openjdk 21", stdout: "" }
    ]);
    const runner = new LocalLanguageRunner({
      executableOverrides: { java: "/tools/java", kotlinc: "/tools/kotlinc" },
      executor,
      language: "kotlin"
    });

    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    expect(executor.calls.map(({ command }) => command)).toEqual(["/tools/kotlinc", "/tools/java"]);
  });

  it("compiles in a private workspace and runs the Kotlin JAR", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "kotlinc", stdout: "" },
      { exitCode: 0, stderr: "java", stdout: "" },
      { exitCode: 0, stderr: "", stdout: "" },
      { exitCode: 0, stderr: "", stdout: "Hello, Kotlin!\n" }
    ]);
    const runner = new LocalLanguageRunner({ executor, language: "kotlin" });
    await runner.availability();

    const result = await runner.run('fun main() { println("Hello, Kotlin!") }');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Hello, Kotlin!\n");
    expect(executor.calls.at(-2)?.arguments_).toContain("-include-runtime");
    expect(executor.calls.at(-1)?.arguments_[0]).toBe("-jar");
  });

  it("passes SQL through stdin without invoking a shell", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "", stdout: "3.46.1" },
      { exitCode: 0, stderr: "", stdout: "2\n" }
    ]);
    const runner = new LocalLanguageRunner({ executor, language: "sql" });
    await runner.availability();
    const result = await runner.run("select 1 + 1;");

    expect(result.stdout).toBe("2\n");
    expect(executor.calls.at(-1)?.command).toBe("sqlite3");
    expect(executor.calls.at(-1)?.options?.stdin).toBe("select 1 + 1;");
  });

  it("reports a missing override and never installs a runtime", async () => {
    const executor = new FakeExecutor([{ exitCode: 127, stderr: "ENOENT", stdout: "" }]);
    const runner = new LocalLanguageRunner({
      executableOverrides: { python: "/missing/python" },
      executor,
      language: "python"
    });

    await expect(runner.availability()).resolves.toEqual({
      available: false,
      detail: "python executable을 /missing/python에서 찾지 못했습니다."
    });
  });
});
