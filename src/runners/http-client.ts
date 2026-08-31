export type FetchLike = typeof fetch;

export const unavailableFetch: FetchLike = async () => {
  throw new TypeError("No HTTP adapter is configured for this environment.");
};

export async function fetchWithTimeout(
  fetch_: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch_(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
