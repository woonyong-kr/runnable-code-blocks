import { requestUrl } from "obsidian";
import type { FetchLike } from "./runners/http-client";

export const obsidianFetch: FetchLike = async (input, init = {}) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body = typeof init.body === "string" || init.body instanceof ArrayBuffer
    ? init.body
    : undefined;
  const pending = requestUrl({
    body,
    headers,
    method: init.method,
    throw: false,
    url
  });
  const response = await abortable(pending, init.signal);
  const emptyBody = [204, 205, 304].includes(response.status);
  return new Response(emptyBody ? null : response.text, {
    headers: response.headers,
    status: response.status
  });
};

async function abortable<T>(pending: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (signal === null || signal === undefined) return await pending;
  if (signal.aborted) throw new DOMException("The request was aborted.", "AbortError");
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("The request was aborted.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    void pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
