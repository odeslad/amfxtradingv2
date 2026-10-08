export type PipeState = 'listening' | 'connected' | 'error' | 'disabled';

export interface BrokerLiveness {
  pipe: PipeState;
  lastTickAt: Date | null;
  lastSyncAt: Date | null;
  watcher: boolean;
}

export interface BrokerHealth {
  name: string;
  pipe: PipeState;
  lastTickAt: string | null;
  lastSyncAt: string | null;
  tickAgeS: number | null;
  syncAgeS: number | null;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeS: number;
  brokers: BrokerHealth[];
}

const STALE_TICK_MS = 5 * 60_000;

const state = new Map<string, BrokerLiveness>();

export function register(broker: string, features: { pipe: boolean; watcher: boolean }): void {
  state.set(broker, {
    pipe: features.pipe ? 'listening' : 'disabled',
    lastTickAt: null,
    lastSyncAt: null,
    watcher: features.watcher,
  });
}

export function setPipeState(broker: string, pipe: PipeState): void {
  const entry = state.get(broker);
  if (entry) entry.pipe = pipe;
}

export function touchTick(broker: string, at = new Date()): void {
  const entry = state.get(broker);
  if (entry) entry.lastTickAt = at;
}

export function touchSync(broker: string, at = new Date()): void {
  const entry = state.get(broker);
  if (entry) entry.lastSyncAt = at;
}

export function pipeStateOf(broker: string): PipeState | null {
  return state.get(broker)?.pipe ?? null;
}

// A disabled pipe (local development) counts as live: nothing is expected from it.
export const isPipeLive = (pipe: PipeState): boolean => pipe === 'connected' || pipe === 'disabled';

export function snapshot(): Map<string, BrokerLiveness> {
  return new Map([...state].map(([name, entry]) => [name, { ...entry }]));
}

const ageS = (now: Date, at: Date | null): number | null =>
  at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;

// A broker is live when its EA holds the pipe and sent something in the last
// 5 min; a disabled pipe (local development) is not a failure.
export function healthReport(now: Date, startedAt: Date, brokers: Map<string, BrokerLiveness>): HealthReport {
  const entries: BrokerHealth[] = [...brokers].map(([name, b]) => ({
    name,
    pipe: b.pipe,
    lastTickAt: b.lastTickAt?.toISOString() ?? null,
    lastSyncAt: b.lastSyncAt?.toISOString() ?? null,
    tickAgeS: ageS(now, b.lastTickAt),
    syncAgeS: ageS(now, b.lastSyncAt),
  }));
  const degraded = entries.some(b =>
    b.pipe !== 'disabled' && (b.pipe !== 'connected' || b.tickAgeS === null || b.tickAgeS * 1000 > STALE_TICK_MS),
  );
  return {
    status: degraded ? 'degraded' : 'ok',
    uptimeS: ageS(now, startedAt) ?? 0,
    brokers: entries,
  };
}
