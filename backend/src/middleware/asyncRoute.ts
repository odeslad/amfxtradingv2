import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler<Req extends Request> = (req: Req, res: Response, next: NextFunction) => Promise<void>;

// Express 4 ignores a rejected handler promise; forward it to the error
// middleware so a failing request answers 500 instead of ending the process.
export const asyncRoute = <Req extends Request = Request>(fn: AsyncHandler<Req>): RequestHandler =>
  (req, res, next) => { fn(req as Req, res, next).catch(next); };
