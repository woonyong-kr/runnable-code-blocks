export type FetchLike = typeof fetch;

export const unavailableFetch: FetchLike = async () => {
  throw new TypeError("No HTTP adapter is configured for this environment.");
};

export async function fetchWithTimeout(
  fetch_: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted === true) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch_(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
