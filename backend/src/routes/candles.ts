import { Router } from 'express';
import { db } from '../db/client';
import { calculateEma } from '../indicators/ema';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery, intParam, epochParam } from '../middleware/parse';

const router = Router();

const MAX_LIMIT = 5000;

// EMA series computed from the FULL history so the chart's lines and crosses
// match the scanner exactly. Returns only the points inside [from, to]; the
// warmup before `from` is computed but not sent. This replaces the frontend's
// own EMA calc, which drifted from the backend's for slow periods.
router.get('/emas', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const symbol = singleQuery(req.query, 'symbol');
  const tf = singleQuery(req.query, 'tf');
  const emaFast = singleQuery(req.query, 'emaFast');
  const emaSlow = singleQuery(req.query, 'emaSlow');

  if (!broker || !symbol || !tf || !emaFast || !emaSlow) {
    res.status(400).json({ error: 'broker, symbol, tf, emaFast and emaSlow are required' });
    return;
  }

  const fastPeriod = intParam(emaFast, 'emaFast', { min: 1 }) as number;
  const slowPeriod = intParam(emaSlow, 'emaSlow', { min: 1 }) as number;
  const fromDate = epochParam(singleQuery(req.query, 'from'), 'from');
  const toDate = epochParam(singleQuery(req.query, 'to'), 'to');

  const candles = await db.candle.findMany({
    where: {
      broker,
      symbol,
      timeframe: tf,
      ...(toDate ? { time: { lte: toDate } } : {}),
    },
    orderBy: { time: 'asc' },
    select: { time: true, open: true, high: true, low: true, close: true },
  });

  const fast = calculateEma(candles, fastPeriod);
  const slow = calculateEma(candles, slowPeriod);

  const out: { time: Date; fast: number | null; slow: number | null }[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (fromDate && candles[i].time < fromDate) continue;
    out.push({ time: candles[i].time, fast: fast[i], slow: slow[i] });
  }

  res.json(out);
}));

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
