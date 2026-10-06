import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery, intParam, epochParam } from '../middleware/parse';

const router = Router();

const MAX_LIMIT = 5000;

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const symbol = singleQuery(req.query, 'symbol');
  const tf = singleQuery(req.query, 'tf');
  if (!broker || !symbol || !tf) {
    res.status(400).json({ error: 'broker, symbol and tf are required' });
    return;
  }

  const take = intParam(singleQuery(req.query, 'limit'), 'limit', { min: 1, max: MAX_LIMIT, default: 500, clamp: true });
  const beforeDate = epochParam(singleQuery(req.query, 'before'), 'before');
  const afterDate = epochParam(singleQuery(req.query, 'after'), 'after');

  // `after` loads forward (oldest→newest); `before` (default) loads backward.
  // If both are given, `before` wins.
  if (afterDate && !beforeDate) {
    const candles = await db.candle.findMany({
      where: { broker, symbol, timeframe: tf, time: { gt: afterDate } },
      orderBy: { time: 'asc' },
      take,
      select: { time: true, open: true, high: true, low: true, close: true },
    });
    res.json(candles.map(c => ({ openTime: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    return;
  }

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
}));

export default router;
