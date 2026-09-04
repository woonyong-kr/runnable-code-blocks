import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DartPadFrameExecutor,
  DartPadRunner,
  decorateDartJavaScript,
  type DartFrameExecutor
} from "../src/runners/dartpad-runner";
import { DART_DONE_MARKER, DART_ERROR_MARKER, instrumentDartSource } from "../src/runners/dart-source-instrumentation";
import { KotlinPlaygroundRunner } from "../src/runners/kotlin-playground-runner";
import { SwiftFiddleRunner } from "../src/runners/swiftfiddle-runner";
import { resetWandboxCompilerCache, WandboxRunner } from "../src/runners/wandbox-runner";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  headers: { "Content-Type": "application/json" },
  status
});

beforeEach(() => resetWandboxCompilerCache());

describe("WandboxRunner adapter", () => {
  it("coalesces concurrent compiler-list preflights", async () => {
    const fetch_ = vi.fn().mockResolvedValue(json([
      { language: "Python", name: "cpython-3.13.8", version: "3.13.8" },
      { language: "Go", name: "go-1.23.2", version: "1.23.2" }
    ]));
    const python = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "python", remoteLanguage: "Python" });
    const go = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "go", remoteLanguage: "Go" });

    await expect(Promise.all([python.availability(), go.availability()])).resolves.toEqual([
      expect.objectContaining({ available: true }),
      expect.objectContaining({ available: true })
    ]);
    expect(fetch_).toHaveBeenCalledOnce();
  });

  it("selects a stable compiler from the live-schema list and maps output", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([
        { language: "Python", name: "cpython-head", version: "" },
        { language: "Python", name: "cpython-3.13.8", version: "3.13.8" }
      ]))
      .mockResolvedValueOnce(json({
        compiler_error: "",
        compiler_output: "",
        program_error: "",
        program_output: "remote-ok\n",
        status: "0"
      }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "python", remoteLanguage: "Python" });

    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run("print('remote-ok')")).resolves.toMatchObject({
      exitCode: 0,
      provider: "Wandbox · cpython-3.13.8",
      stdout: "remote-ok\n"
    });
    expect(JSON.parse(String(fetch_.mock.calls[1]?.[1]?.body))).toMatchObject({
      compiler: "cpython-3.13.8",
      save: false
    });
  });

  it("treats rate limiting as safe to fallback", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "Java", name: "openjdk-jdk-22+36", version: "22" }]))
      .mockResolvedValueOnce(new Response("busy", { status: 429 }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "java", remoteLanguage: "Java" });
    await runner.availability();
    await expect(runner.run("class Main {}"))
      .rejects.toEqual(expect.objectContaining({ executionState: "not-started" }));
  });

  it("blocks fallback when a POST returns an ambiguous service failure", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "Java", name: "openjdk-jdk-22+36", version: "22" }]))
      .mockResolvedValueOnce(new Response("proxy failure", { status: 503 }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "java", remoteLanguage: "Java" });
    await runner.availability();
    await expect(runner.run("class Main {}"))
      .rejects.toEqual(expect.objectContaining({ executionState: "unknown" }));
  });

  it("marks a lost POST response unknown so code is not executed twice", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "Ruby", name: "ruby-3.4.9", version: "3.4.9" }]))
      .mockRejectedValueOnce(new TypeError("network lost"));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "ruby", remoteLanguage: "Ruby" });
    await runner.availability();
    await expect(runner.run("puts 'x'"))
      .rejects.toEqual(expect.objectContaining({ executionState: "unknown" }));
  });

  it("reports missing compilers and preflight failures without submitting code", async () => {
    const missing = new WandboxRunner({
      fetch: vi.fn().mockResolvedValue(json([])) as typeof fetch,
      language: "go",
      remoteLanguage: "Go"
    });
    await expect(missing.availability()).resolves.toMatchObject({ available: false });
    await expect(missing.run("package main"))
      .rejects.toEqual(expect.objectContaining({ executionState: "not-started" }));

    const offline = new WandboxRunner({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline")) as typeof fetch,
      language: "go",
      remoteLanguage: "Go"
    });
    await expect(offline.availability()).resolves.toMatchObject({ available: false });
  });

  it("maps remote compiler and runtime diagnostics to a failed result", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "C#", name: "mono-6.12.0.199", version: "6" }]))
      .mockResolvedValueOnce(json({ compiler_error: "compile failed", program_output: "partial", status: "1" }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "csharp", remoteLanguage: "C#" });
    await runner.availability();
    await expect(runner.run("bad")) .resolves.toMatchObject({
      exitCode: 1,
      stderr: "compile failed",
      stdout: "partial"
    });
  });

  it("classifies a container creation rejection as not started", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "JavaScript", name: "nodejs-20.17.0", version: "20" }]))
      .mockResolvedValueOnce(json({
        program_error: "Error: OCI runtime error: crun: clone: Resource temporarily unavailable",
        status: "126"
      }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "javascript", remoteLanguage: "JavaScript" });
    await runner.availability();
    await expect(runner.run("code")).rejects.toMatchObject({ executionState: "not-started" });
  });

  it("does not report a malformed successful HTTP response as completed code", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ language: "Python", name: "cpython-3.13.8", version: "3.13.8" }]))
      .mockResolvedValueOnce(json({ program_output: 123, status: "0" }));
    const runner = new WandboxRunner({ fetch: fetch_ as typeof fetch, language: "python", remoteLanguage: "Python" });
    await runner.availability();
    await expect(runner.run("print('once')")).rejects.toMatchObject({ executionState: "unknown" });
  });
});

describe("KotlinPlaygroundRunner adapter", () => {
  it("uses the latest stable compiler and parses stdout", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ latestStable: true, version: "2.4.10" }]))
      .mockResolvedValueOnce(json({ errors: { "File.kt": [] }, exception: null, text: "<outStream>kotlin-ok\n</outStream>" }));
    const runner = new KotlinPlaygroundRunner({ fetch: fetch_ as typeof fetch });
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run("fun main() {}")) .resolves.toMatchObject({
      exitCode: 0,
      provider: "Kotlin Playground · 2.4.10",
      stdout: "kotlin-ok\n"
    });
  });

  it("returns compiler diagnostics without falling back", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ latestStable: true, version: "2.4.10" }]))
      .mockResolvedValueOnce(json({
        errors: { "File.kt": [{ message: "expecting expression", severity: "ERROR" }] },
        exception: null,
        text: ""
      }));
    const runner = new KotlinPlaygroundRunner({ fetch: fetch_ as typeof fetch });
    await runner.availability();
    await expect(runner.run("fun main( {")).resolves.toMatchObject({ exitCode: 1, stderr: "expecting expression" });
  });

  it("handles unavailable versions, preflight errors, and safe HTTP rejection", async () => {
    const noStable = new KotlinPlaygroundRunner({
      fetch: vi.fn().mockResolvedValue(json([{ latestStable: false, version: "old" }])) as typeof fetch
    });
    await expect(noStable.availability()).resolves.toMatchObject({ available: false });
    await expect(noStable.run("code")).rejects.toMatchObject({ executionState: "not-started" });

    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ latestStable: true, version: "2.4.10" }]))
      .mockResolvedValueOnce(new Response("busy", { status: 429 }));
    const rejected = new KotlinPlaygroundRunner({ fetch: fetch_ as typeof fetch });
    await rejected.availability();
    await expect(rejected.run("code")).rejects.toMatchObject({ executionState: "not-started" });

    const offline = new KotlinPlaygroundRunner({ fetch: vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch });
    await expect(offline.availability()).resolves.toMatchObject({ available: false });
  });

  it("preserves stderr streams and remote exceptions", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ latestStable: true, version: "2.4.10" }]))
      .mockResolvedValueOnce(json({ errors: {}, exception: { message: "boom" }, text: "<errStream>warning</errStream>" }));
    const runner = new KotlinPlaygroundRunner({ fetch: fetch_ as typeof fetch });
    await runner.availability();
    await expect(runner.run("code")).resolves.toMatchObject({ exitCode: 1, stderr: expect.stringContaining("warning") });
  });

  it("does not report a malformed successful HTTP response as completed code", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json([{ latestStable: true, version: "2.4.10" }]))
      .mockResolvedValueOnce(json({ errors: { "File.kt": [null] }, exception: null, text: "" }));
    const runner = new KotlinPlaygroundRunner({ fetch: fetch_ as typeof fetch });
    await runner.availability();
    await expect(runner.run("println(\"once\")")).rejects.toMatchObject({ executionState: "unknown" });
  });
});

describe("DartPadRunner adapter", () => {
  it("compiles with DartPad and executes the JavaScript in an isolated frame", async () => {
    const execute = vi.fn(async () => ({
      durationMs: 8,
      exitCode: 0,
      stderr: "",
      stdout: "dart-ok"
    }));
    const executor: DartFrameExecutor = { execute };
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json({ dartVersion: "3.13.2" }))
      .mockResolvedValueOnce(json({ result: "compiled-dart-javascript" }));
    const runner = new DartPadRunner({ executor, fetch: fetch_ as typeof fetch });
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run('void main() { print("dart-ok"); }')).resolves.toMatchObject({
      exitCode: 0,
      provider: "DartPad · 3.13.2 → isolated frame",
      stdout: "dart-ok"
    });
    expect(execute).toHaveBeenCalledWith("compiled-dart-javascript", 15_000, undefined);
    expect(JSON.parse(String(fetch_.mock.calls[1]?.[1]?.body))).toEqual({
      deltaDill: null,
      source: instrumentDartSource('void main() { print("dart-ok"); }')
    });
  });

  it("requires DOM support when no frame executor is injected", async () => {
    const original = globalThis.document;
    vi.stubGlobal("document", undefined);
    await expect(new DartPadRunner().availability()).resolves.toMatchObject({ available: false });
    vi.stubGlobal("document", original);
  });

  it("returns compiler diagnostics without starting a frame", async () => {
    const execute = vi.fn();
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json({ dartVersion: "3.13.2" }))
      .mockResolvedValueOnce(new Response("main.dart: syntax error", { status: 400 }));
    const runner = new DartPadRunner({ executor: { execute }, fetch: fetch_ as typeof fetch });
    await runner.availability();
    await expect(runner.run("void main( {")).resolves.toMatchObject({
      exitCode: 1,
      stderr: "main.dart: syntax error"
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports preflight and compile transport failures as not started", async () => {
    const rejected = new DartPadRunner({ fetch: vi.fn().mockResolvedValue(new Response("no", { status: 503 })) as typeof fetch });
    await expect(rejected.availability()).resolves.toMatchObject({ available: false });
    const offline = new DartPadRunner({ fetch: vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch });
    await expect(offline.availability()).resolves.toMatchObject({ available: false });

    const fetch_ = vi.fn()
      .mockResolvedValueOnce(json({ dartVersion: "3.13.2" }))
      .mockRejectedValueOnce(new Error("compile offline"));
    const compileOffline = new DartPadRunner({
      executor: { execute: vi.fn() },
      fetch: fetch_ as typeof fetch
    });
    await compileOffline.availability();
    await expect(compileOffline.run("void main() {}"))
      .rejects.toEqual(expect.objectContaining({ executionState: "not-started" }));
  });

  it("decorates compiled DDC output with isolated stdout and completion messages", () => {
    const decorated = decorateDartJavaScript("compiled-body");
    expect(decorated).toContain("compiled-body");
    expect(decorated).toContain(DART_DONE_MARKER);
    expect(decorated).toContain(DART_ERROR_MARKER);
    expect(decorated).toContain("stable.api.dartpad.dev/artifacts/");
    expect(decorated).toContain('type: "rcb-done"');
    expect(decorated).toContain("dartDevEmbedder.runMain");
  });
});

describe("instrumentDartSource", () => {
  it("renames a top-level main and emits completion from an async wrapper", () => {
    const source = instrumentDartSource(`
Future<void> main() async {
  await Future<void>.delayed(const Duration(milliseconds: 10));
}`);
    expect(source).toContain("Future<void> __rcbUserMain() async");
    expect(source).toContain("Function.apply(__rcbUserMain, const <dynamic>[])");
    expect(source).toContain(`print('${DART_DONE_MARKER}')`);
  });

  it("passes an empty argument list to the conventional List<String> main parameter", () => {
    const source = instrumentDartSource("void main(List<String> args) => print(args.length);");
    expect(source).toContain("Function.apply(__rcbUserMain, const <dynamic>[<String>[]])");
  });

  it("ignores main-shaped text in comments, strings, and class bodies", () => {
    const source = instrumentDartSource(`
// void main() {}
const example = 'void main() {}';
class Example { void main() {} }
void main() => print('ok');`);
    expect(source).toContain("class Example { void main() {} }");
    expect(source).toContain("void __rcbUserMain() => print('ok');");
  });

  it("leaves source without a top-level main unchanged", () => {
    const source = "class Example { void main() {} }";
    expect(instrumentDartSource(source)).toBe(source);
  });
});

describe("DartPadFrameExecutor", () => {
  it("collects stdout from the isolated frame until its completion message", async () => {
    const executor = new DartPadFrameExecutor("about:blank");
    const pending = executor.execute("compiled-body", 1_000);
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Isolated dart execution frame"]');
    expect(frame).not.toBeNull();
    expect(frame?.className).toBe("rcb__dart-execution-frame");
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    const postMessage = vi.spyOn(frame?.contentWindow as Window, "postMessage").mockImplementation(() => undefined);
    const send = (data: Record<string, unknown>) => window.dispatchEvent(new MessageEvent("message", {
      data: { sender: "frame", ...data },
      origin: "null",
      source: frame?.contentWindow
    }));

    send({ type: "ready" });
    send({ type: "ready" });
    send({ message: "dart-ok", type: "stdout" });
    send({ type: "rcb-done" });

    await expect(pending).resolves.toMatchObject({ exitCode: 0, stderr: "", stdout: "dart-ok" });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: "execute" }), "*");
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(frame?.isConnected).toBe(false);
  });

  it("reports stderr from an executed frame", async () => {
    const executor = new DartPadFrameExecutor("about:blank");
    const pending = executor.execute("compiled-body", 1_000);
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Isolated dart execution frame"]');
    vi.spyOn(frame?.contentWindow as Window, "postMessage").mockImplementation(() => undefined);
    const send = (data: Record<string, unknown>) => window.dispatchEvent(new MessageEvent("message", {
      data: { sender: "frame", ...data },
      origin: "null",
      source: frame?.contentWindow
    }));
    send({ type: "ready" });
    send({ message: "dart failure", type: "jserr" });
    send({ type: "rcb-done" });

    await expect(pending).resolves.toMatchObject({ exitCode: 1, stderr: "dart failure" });
  });

  it("allows fallback when the frame never becomes ready", async () => {
    vi.useFakeTimers();
    const pending = new DartPadFrameExecutor("about:blank").execute("compiled-body", 50);
    const assertion = expect(pending).rejects.toMatchObject({ executionState: "not-started" });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });

  it("returns a timeout result instead of falling back after execution starts", async () => {
    vi.useFakeTimers();
    const pending = new DartPadFrameExecutor("about:blank").execute("compiled-body", 50);
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Isolated dart execution frame"]');
    vi.spyOn(frame?.contentWindow as Window, "postMessage").mockImplementation(() => undefined);
    window.dispatchEvent(new MessageEvent("message", {
      data: { sender: "frame", type: "ready" },
      origin: "null",
      source: frame?.contentWindow
    }));
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toMatchObject({
      exitCode: 124,
      stderr: expect.stringContaining("exceeded")
    });
    vi.useRealTimers();
  });
});

describe("SwiftFiddleRunner adapter", () => {
  it("parses the official streaming response", async () => {
    const fetch_ = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 204 }))
      .mockResolvedValueOnce(new Response([
        JSON.stringify({ kind: "version", text: "Swift version 6.3.3\nTarget: linux\n" }),
        JSON.stringify({ kind: "stdout", text: "swift-ok\n" })
      ].join("\n"), { status: 200 }));
    const runner = new SwiftFiddleRunner({ fetch: fetch_ as typeof fetch });
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run('print("swift-ok")')).resolves.toMatchObject({
      exitCode: 0,
      provider: "SwiftFiddle · Swift version 6.3.3",
      stdout: "swift-ok\n"
    });
  });

  it("maps diagnostics and safe request rejection", async () => {
    const diagnostic = new SwiftFiddleRunner({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: "stderr", text: "compile error" }), { status: 200 })) as typeof fetch
    });
    await expect(diagnostic.run("bad")).resolves.toMatchObject({ exitCode: 1, stderr: "compile error" });

    const rejected = new SwiftFiddleRunner({
      fetch: vi.fn().mockResolvedValue(new Response("busy", { status: 429 })) as typeof fetch
    });
    await expect(rejected.run("code")).rejects.toMatchObject({ executionState: "not-started" });
  });

  it("reports failed preflight", async () => {
    const runner = new SwiftFiddleRunner({ fetch: vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch });
    await expect(runner.availability()).resolves.toMatchObject({ available: false });
  });

  it("does not report an empty successful HTTP response as completed code", async () => {
    const runner = new SwiftFiddleRunner({
      fetch: vi.fn().mockResolvedValue(new Response("", { status: 200 })) as typeof fetch
    });
    await expect(runner.run("print(\"once\")")).rejects.toMatchObject({ executionState: "unknown" });
  });
});
