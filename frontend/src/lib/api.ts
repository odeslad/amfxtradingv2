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
