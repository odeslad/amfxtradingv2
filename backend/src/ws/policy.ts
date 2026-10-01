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
