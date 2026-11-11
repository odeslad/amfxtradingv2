// Shared by the CORS middleware and the WebSocket upgrade gate.
export const ALLOWED_ORIGINS: ReadonlyArray<string | RegExp> = [/\.amfxtrading\.com(:\d+)?$/];

// A browser always sends Origin on a WebSocket handshake, so a missing one is rejected
// here (the CORS middleware keeps accepting origin-less requests: curl, health checks).
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(o => (typeof o === 'string' ? o === origin : o.test(origin)));
}

export function tokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'token' && rest.length > 0) return rest.join('=');
  }
  return null;
}

export const HEARTBEAT_MS = 30_000;
export const SKIP_ABOVE_BYTES = 1 << 20;
export const KILL_ABOVE_BYTES = 8 << 20;

export type SendDecision = 'send' | 'skip' | 'terminate';

// A slow client loses individual messages before it loses the connection.
export function sendDecision(bufferedAmount: number): SendDecision {
  if (bufferedAmount > KILL_ABOVE_BYTES) return 'terminate';
  if (bufferedAmount > SKIP_ABOVE_BYTES) return 'skip';
  return 'send';
}

// Tick subscription (spec 041): the client names the broker/symbol pairs it needs and
// receives ticks of those only. The frame replaces the whole set; an empty list stops them.
export const SUBSCRIBE_MAX_PAIRS = 16;
export const SUBSCRIBE_MAX_PAYLOAD = 4096;
const SUBSCRIBE_MAX_NAME = 64;

export const tickKey = (broker: string, symbol: string): string => `${broker}|${symbol}`;

const isName = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= SUBSCRIBE_MAX_NAME;

// The set of `broker|symbol` keys of a valid `subscribe` frame, or null for anything
// else: the caller keeps the previous set rather than guessing.
export function parseSubscription(raw: unknown): Set<string> | null {
  let message: unknown;
  try {
    message = JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { type, ticks } = message as { type?: unknown; ticks?: unknown };
  if (type !== 'subscribe' || !Array.isArray(ticks) || ticks.length > SUBSCRIBE_MAX_PAIRS) return null;
  const keys = new Set<string>();
  for (const item of ticks) {
    if (typeof item !== 'object' || item === null) return null;
    const { broker, symbol } = item as { broker?: unknown; symbol?: unknown };
    if (!isName(broker) || !isName(symbol)) return null;
    keys.add(tickKey(broker, symbol));
  }
  return keys;
}
