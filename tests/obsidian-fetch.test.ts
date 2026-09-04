import * as Obsidian from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { obsidianFetch } from "../src/obsidian-fetch";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("obsidianFetch", () => {
  it("maps Fetch input and init to requestUrl and maps its response back", async () => {
    const requestUrl = vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      arrayBuffer: new ArrayBuffer(0),
      headers: { "content-type": "application/json" },
      json: { ok: true },
      status: 201,
      text: '{"ok":true}'
    });

    const response = await obsidianFetch(new URL("https://example.test/run"), {
      body: "source",
      headers: { "x-runner": "test" },
      method: "POST"
    });

    expect(requestUrl).toHaveBeenCalledWith({
      body: "source",
      headers: { "x-runner": "test" },
      method: "POST",
      throw: false,
      url: "https://example.test/run"
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.text()).resolves.toBe('{"ok":true}');
  });

  it("uses an empty body for response statuses that forbid one", async () => {
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      arrayBuffer: new ArrayBuffer(0),
      headers: {},
      json: null,
      status: 204,
      text: "ignored"
    });

    const response = await obsidianFetch("https://example.test/no-content");

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });

  it("rejects before dispatch when the signal is already aborted", async () => {
    const requestUrl = vi.spyOn(Obsidian, "requestUrl");
    const controller = new AbortController();
    controller.abort();

    await expect(obsidianFetch("https://example.test/aborted", { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });

    expect(requestUrl).not.toHaveBeenCalled();
  });

  it("rejects a pending response on abort and preserves upstream failures", async () => {
    let resolvePending: ((response: Awaited<ReturnType<typeof Obsidian.requestUrl>>) => void) | undefined;
    const pending = new Promise<Awaited<ReturnType<typeof Obsidian.requestUrl>>>((resolve) => {
      resolvePending = resolve;
    });
    vi.spyOn(Obsidian, "requestUrl").mockReturnValueOnce(
      pending as ReturnType<typeof Obsidian.requestUrl>
    );
    const controller = new AbortController();
    const aborted = obsidianFetch("https://example.test/pending", { signal: controller.signal });
    controller.abort();

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    resolvePending?.({
      arrayBuffer: new ArrayBuffer(0), headers: {}, json: null, status: 200, text: "late"
    });
    await pending;

    vi.spyOn(Obsidian, "requestUrl").mockRejectedValueOnce(new Error("upstream unavailable"));
    await expect(obsidianFetch("https://example.test/failure")).rejects.toThrow("upstream unavailable");
  });
});
