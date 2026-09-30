import type { Request, Response, NextFunction } from 'express';

export class BadRequest extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}

// Both keys because existing consumers read `error` (commands, settings) or
// `message` (auth, alerts) depending on the route.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BadRequest) {
    res.status(400).json({ error: err.message, message: err.message });
    return;
  }
  console.error(`[HTTP] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal error' });
}
