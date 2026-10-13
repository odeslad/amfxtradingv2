const BASE = import.meta.env.VITE_API_BASE ?? '';

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

// Error text of a failed response: the backend's `error`/`message` field, or the status.
export async function errorFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return body.error ?? body.message ?? `Error ${res.status}`;
}

export function errorMessage(err: unknown, fallback = 'Network error'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// Credentials, JSON header on bodies, 401 hook, ApiError on non-OK, undefined on empty bodies.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = init.body !== undefined
    ? { 'Content-Type': 'application/json', ...init.headers }
    : { ...init.headers };
  const res = await fetch(apiUrl(path), { credentials: 'include', ...init, headers });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) throw new ApiError(res.status, await errorFrom(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type SendMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function apiSend<T = void>(path: string, method: SendMethod, body?: unknown, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method, body: body === undefined ? undefined : JSON.stringify(body) });
}
