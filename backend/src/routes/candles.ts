import { Router } from 'express';
import { db } from '../db/client';
import { calculateEma } from '../engine/indicators/ema';

const router = Router();

// EMA series computed from the FULL history (same calculateEma the backtest
// uses) so the chart's lines and crosses match the setups exactly. Returns only
// the points inside [from, to]; the warmup before `from` is computed but not
// sent. This replaces the frontend's own EMA calc, which drifted from the
// backend's for slow periods.
router.get('/emas', async (req, res) => {
  const { broker, symbol, tf, emaFast, emaSlow, from, to } = req.query as Record<string, string>;

  if (!broker || !symbol || !tf || !emaFast || !emaSlow) {
    res.status(400).json({ error: 'broker, symbol, tf, emaFast and emaSlow are required' });
    return;
  }

  const fastPeriod = parseInt(emaFast, 10);
  const slowPeriod = parseInt(emaSlow, 10);
  const fromDate = from ? new Date(parseInt(from, 10) * 1000) : undefined;
  const toDate = to ? new Date(parseInt(to, 10) * 1000) : undefined;

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
});

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
