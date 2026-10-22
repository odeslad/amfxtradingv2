import type { Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = 'BadRequest';
  }
}

export class NotFound extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFound';
  }
}

export class Conflict extends HttpError {
  constructor(message: string) {
    super(409, message);
    this.name = 'Conflict';
  }
}

// express.json() rejects unparseable bodies with this error type.
const isBodyParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';

// Both keys because existing consumers read `error` (commands, settings) or
// `message` (auth, alerts) depending on the route.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError || isBodyParseError(err)) {
    const status = err instanceof HttpError ? err.status : 400;
    const message = err instanceof HttpError ? err.message : 'Malformed JSON body';
    res.status(status).json({ error: message, message });
    return;
  }
  console.error(`[HTTP] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal error' });
}
