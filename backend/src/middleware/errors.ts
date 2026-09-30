import type { Request, Response, NextFunction } from 'express';

export class BadRequest extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}

// express.json() rejects unparseable bodies with this error type.
const isBodyParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';

// Both keys because existing consumers read `error` (commands, settings) or
// `message` (auth, alerts) depending on the route.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BadRequest || isBodyParseError(err)) {
    const message = err instanceof BadRequest ? err.message : 'Malformed JSON body';
    res.status(400).json({ error: message, message });
    return;
  }
  console.error(`[HTTP] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal error' });
}
