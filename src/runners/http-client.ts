export type FetchLike = typeof fetch;

export async function fetchWithTimeout(
  fetch_: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch_(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
