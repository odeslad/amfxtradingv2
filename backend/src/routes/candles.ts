import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req, res) => {
  const { broker, symbol, tf, limit, before, after } = req.query as Record<string, string>;

  if (!broker || !symbol || !tf) {
    res.status(400).json({ error: 'broker, symbol and tf are required' });
    return;
  }

  const take = limit ? Math.min(parseInt(limit, 10), 5000) : 500;

  // `after` loads forward (oldest→newest); `before` (default) loads backward.
  // If both are given, `before` wins.
  if (after && !before) {
    const afterDate = new Date(parseInt(after, 10) * 1000);
    const candles = await db.candle.findMany({
      where: { broker, symbol, timeframe: tf, time: { gt: afterDate } },
      orderBy: { time: 'asc' },
      take,
      select: { time: true, open: true, high: true, low: true, close: true },
    });
    res.json(candles.map(c => ({ openTime: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    return;
  }

  const beforeDate = before ? new Date(parseInt(before, 10) * 1000) : undefined;

  const candles = await db.candle.findMany({
    where: {
      broker,
      symbol,
      timeframe: tf,
      ...(beforeDate ? { time: { lt: beforeDate } } : {}),
    },
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
