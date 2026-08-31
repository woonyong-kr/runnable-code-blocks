import { beforeEach, describe, expect, it, vi } from "vitest";
import { DartPadRunner } from "../src/runners/dartpad-runner";
import { KotlinPlaygroundRunner } from "../src/runners/kotlin-playground-runner";
import { ProviderUnavailableError } from "../src/runners/provider-errors";
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

  it("marks a lost POST response unknown so local code is not duplicated", async () => {
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
});

describe("DartPadRunner adapter", () => {
  it("returns an injectable official DartPad embed", async () => {
    const runner = new DartPadRunner({ fetch: vi.fn().mockResolvedValue(json({ dartVersion: "3.13.2" })) as typeof fetch });
    await expect(runner.availability()).resolves.toMatchObject({ available: true });
    await expect(runner.run("void main() {}")) .resolves.toMatchObject({
      provider: "DartPad · 3.13.2",
      preview: {
        kind: "remote-iframe",
        postMessage: { sourceCode: "void main() {}", type: "sourceCode" }
      }
    });
  });

  it("requires preflight DOM support", async () => {
    const original = globalThis.document;
    vi.stubGlobal("document", undefined);
    await expect(new DartPadRunner().run("void main() {}"))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
    vi.stubGlobal("document", original);
  });

  it("reports DartPad HTTP and network failures", async () => {
    const rejected = new DartPadRunner({ fetch: vi.fn().mockResolvedValue(new Response("no", { status: 503 })) as typeof fetch });
    await expect(rejected.availability()).resolves.toMatchObject({ available: false });
    const offline = new DartPadRunner({ fetch: vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch });
    await expect(offline.availability()).resolves.toMatchObject({ available: false });
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
});
