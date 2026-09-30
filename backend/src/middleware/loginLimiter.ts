import type { Request } from 'express';

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;
const SWEEP_MS = 5 * 60_000;

interface Failures {
  count: number;
  first: number;
}

// In-process only: a restart clears it, which is fine for a single-user app.
const failures = new Map<string, Failures>();

export function loginKey(req: Request, email: string): string {
  return `${req.ip}|${email.toLowerCase()}`;
}

export function isBlocked(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: now });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of failures) {
    if (now - entry.first > WINDOW_MS) failures.delete(key);
  }
}

setInterval(sweep, SWEEP_MS).unref();
