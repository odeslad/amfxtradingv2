import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req, res) => {
  const { broker, symbol, tf, limit } = req.query as Record<string, string>;

  if (!broker || !symbol || !tf) {
    res.status(400).json({ error: 'broker, symbol and tf are required' });
    return;
  }

  const take = limit ? Math.min(parseInt(limit, 10), 10000) : undefined;

  const candles = await db.candle.findMany({
    where: { broker, symbol, timeframe: tf },
    orderBy: { time: 'desc' },
    take,
    select: { time: true, open: true, high: true, low: true, close: true },
  });

  candles.reverse();

  res.json(candles.map(c => ({
    openTime: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  })));
});

export default router;
