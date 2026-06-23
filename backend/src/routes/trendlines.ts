import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

function getContext(req: AuthRequest): { broker: string; symbol: string; timeframe: string } | null {
  const broker = req.query.broker ?? req.body?.broker;
  const symbol = req.query.symbol ?? req.body?.symbol;
  const timeframe = req.query.timeframe ?? req.body?.timeframe;
  if (typeof broker !== 'string' || typeof symbol !== 'string' || typeof timeframe !== 'string') return null;
  if (!broker || !symbol || !timeframe) return null;
  return { broker, symbol, timeframe };
}

router.get('/', async (req: AuthRequest, res) => {
  const ctx = getContext(req);
  if (!ctx) { res.status(400).json({ message: 'broker, symbol and timeframe are required' }); return; }

  const record = await db.trendline.findUnique({
    where: { userId_broker_symbol_timeframe: { userId: req.userId!, ...ctx } },
  });
  res.json({ lines: record?.lines ?? [] });
});

router.put('/', async (req: AuthRequest, res) => {
  const ctx = getContext(req);
  if (!ctx) { res.status(400).json({ message: 'broker, symbol and timeframe are required' }); return; }

  const { lines } = req.body as { lines: unknown };
  if (!Array.isArray(lines)) { res.status(400).json({ message: 'lines must be an array' }); return; }

  const record = await db.trendline.upsert({
    where:  { userId_broker_symbol_timeframe: { userId: req.userId!, ...ctx } },
    update: { lines },
    create: { userId: req.userId!, ...ctx, lines },
  });
  res.json({ lines: record.lines });
});

export default router;
