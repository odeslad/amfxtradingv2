import fs from 'fs';
import path from 'path';

export interface CommandResult {
  id: string;
  status: string;
  ticket?: number;
  code?: number;
  message?: string;
}

export const WAIT_BASE_MS = 10_000;
export const WAIT_PENDING_MS = 30_000;
export const WAIT_LATE_MS = 60_000;
export const POLL_MS = 300;

export type WaitOutcome =
  | { kind: 'result'; result: CommandResult }
  | { kind: 'timeout'; late: Promise<CommandResult | null> };

// Temp file + rename, so the EA (polling every second) never reads a partial command.
export function writeCommand(bridgePath: string, command: object): void {
  const tmp = path.join(bridgePath, 'command.tmp');
  fs.writeFileSync(tmp, JSON.stringify(command));
  fs.renameSync(tmp, path.join(bridgePath, 'command.json'));
}

const readJson = (file: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;   // missing, locked, or the EA is still writing it
  }
};

export function readResult(resultPath: string): CommandResult | null {
  const raw = readJson(resultPath);
  if (!raw || typeof raw['id'] !== 'string') return null;
  return {
    id: raw['id'],
    status: String(raw['status'] ?? 'unknown'),
    ticket: typeof raw['ticket'] === 'number' ? raw['ticket'] : undefined,
    code: typeof raw['code'] === 'number' ? raw['code'] : undefined,
    message: typeof raw['message'] === 'string' && raw['message'] !== '' ? raw['message'] : undefined,
  };
}

export function errorText(result: CommandResult): string | undefined {
  if (result.status === 'ok') return undefined;
  const code = result.code !== undefined ? ` (code ${result.code})` : '';
  return result.message ? `EA error: ${result.message}${code}` : `EA error${code}`;
}

const pendingHas = (pendingPath: string, id: string): boolean => readJson(pendingPath)?.['id'] === id;

const unlinkQuietly = (file: string): void => {
  try { fs.unlinkSync(file); } catch { /* best effort */ }
};

// A result.json nobody consumed (late answer of an earlier command) would
// otherwise be polled over in silence for the whole wait.
export function discardStaleResult(resultPath: string, log: (msg: string) => void): void {
  const stale = readJson(resultPath);
  if (!stale) return;
  unlinkQuietly(resultPath);
  log(`discarding stale result id=${String(stale['id'] ?? '?')} status=${String(stale['status'] ?? '?')}`);
}

interface WaitOptions {
  resultPath: string;
  pendingPath: string;
  id: string;
}

// Base wait as before; extended while the EA signals it is working on this very
// command; after the timeout a background watch still collects a late result.
export function waitForResult({ resultPath, pendingPath, id }: WaitOptions): Promise<WaitOutcome> {
  const start = Date.now();

  const take = (): CommandResult | null => {
    const result = readResult(resultPath);
    if (!result || result.id !== id) return null;
    unlinkQuietly(resultPath);
    return result;
  };

  return new Promise<WaitOutcome>(resolveOutcome => {
    let resolveLate: ((r: CommandResult | null) => void) | null = null;
    let lateUntil = Infinity;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const result = take();
      if (result) {
        clearInterval(timer);
        if (resolveLate) resolveLate(result);
        else resolveOutcome({ kind: 'result', result });
        return;
      }
      if (resolveLate) {
        if (elapsed >= lateUntil) { clearInterval(timer); resolveLate(null); }
        return;
      }
      const stillWorking = elapsed < WAIT_PENDING_MS && pendingHas(pendingPath, id);
      if (elapsed >= WAIT_BASE_MS && !stillWorking) {
        lateUntil = elapsed + WAIT_LATE_MS;
        const late = new Promise<CommandResult | null>(r => { resolveLate = r; });
        resolveOutcome({ kind: 'timeout', late });
      }
    }, POLL_MS);
  });
}
