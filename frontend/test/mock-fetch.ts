import { vi } from "vitest";

export function mockFetchJson(
  handler: (url: string, init?: RequestInit) => { ok: boolean; status?: number; body: unknown },
) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const { ok, status = ok ? 200 : 500, body } = handler(url);
    return Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}
