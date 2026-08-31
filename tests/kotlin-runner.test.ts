import { describe, expect, it } from "vitest";
import {
  LocalKotlinRunner,
  NodeCommandExecutor,
  type CommandExecutor,
  type CommandResult
} from "../src/runners/kotlin-runner";

class FakeExecutor implements CommandExecutor {
  readonly calls: Array<{ arguments_: string[]; command: string; timeoutMs: number }> = [];
  readonly #results: CommandResult[];

  constructor(results: CommandResult[]) {
    this.#results = [...results];
  }

  async execute(command: string, arguments_: string[], timeoutMs: number): Promise<CommandResult> {
    this.calls.push({ arguments_, command, timeoutMs });
    return this.#results.shift() ?? { exitCode: 0, stderr: "", stdout: "" };
  }
}

describe("LocalKotlinRunner", () => {
  it("captures output from the real local command wrapper", async () => {
    const result = await new NodeCommandExecutor().execute(
      process.execPath,
      ["-e", "process.stdout.write('wrapper-ok')"],
      3_000
    );
    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "wrapper-ok" });
  });

  it("checks both compiler and Java without contacting a server", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "kotlinc-jvm 2.x", stdout: "" },
      { exitCode: 0, stderr: "openjdk 21", stdout: "" }
    ]);
    const runner = new LocalKotlinRunner({
      compilerPath: "/tools/kotlinc",
      executor,
      javaPath: "/tools/java"
    });

    await expect(runner.availability()).resolves.toEqual({
      available: true,
      detail: "Runs with local kotlinc and java. No execution server is used."
    });
    expect(executor.calls.map(({ command }) => command)).toEqual(["/tools/kotlinc", "/tools/java"]);
  });

  it("compiles a temporary source and runs the resulting jar", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "", stdout: "" },
      { exitCode: 0, stderr: "", stdout: "Hello, Kotlin!\n" }
    ]);
    const runner = new LocalKotlinRunner({ executor });

    const result = await runner.run('fun main() { println("Hello, Kotlin!") }');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Hello, Kotlin!\n");
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]?.command).toBe("kotlinc");
    expect(executor.calls[0]?.arguments_[0]).toMatch(/runnable-code-blocks-.+\/Main\.kt$/);
    expect(executor.calls[0]?.arguments_).toContain("-include-runtime");
    expect(executor.calls[1]?.command).toBe("java");
    expect(executor.calls[1]?.arguments_[0]).toBe("-jar");
  });

  it("returns compiler diagnostics without running Java", async () => {
    const executor = new FakeExecutor([
      { exitCode: 1, stderr: "Main.kt:1: error: expecting an expression", stdout: "" }
    ]);
    const runner = new LocalKotlinRunner({ executor });

    const result = await runner.run("fun main( {");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("expecting an expression");
    expect(executor.calls).toHaveLength(1);
  });

  it("reports missing compiler before a block can run", async () => {
    const executor = new FakeExecutor([{ exitCode: 1, stderr: "ENOENT", stdout: "" }]);
    const runner = new LocalKotlinRunner({ compilerPath: "/missing/kotlinc", executor });

    await expect(runner.availability()).resolves.toEqual({
      available: false,
      detail: "Kotlin compiler was not found at /missing/kotlinc. Configure kotlinc in plugin settings."
    });
  });

  it("reports missing Java after finding the compiler", async () => {
    const executor = new FakeExecutor([
      { exitCode: 0, stderr: "kotlinc", stdout: "" },
      { exitCode: 1, stderr: "missing", stdout: "" }
    ]);
    const runner = new LocalKotlinRunner({ executor, javaPath: "/missing/java" });

    await expect(runner.availability()).resolves.toEqual({
      available: false,
      detail: "Java was not found at /missing/java."
    });
  });
});
