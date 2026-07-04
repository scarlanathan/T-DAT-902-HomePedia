const DEFAULT_API_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  return url.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJsonResponse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    let detail = res.status === 404 ? "Not found" : `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === "string") detail = body.message;
      else if (Array.isArray(body.message)) detail = body.message.join(", ");
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

const defaultFetchInit: RequestInit = {
  cache: "no-store",
  credentials: "include",
};

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), defaultFetchInit);
  return parseJsonResponse<T>(res, path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const res = await fetch(url.toString(), {
    ...defaultFetchInit,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseJsonResponse<T>(res, path);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const res = await fetch(url.toString(), {
    ...defaultFetchInit,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(res, path);
}
