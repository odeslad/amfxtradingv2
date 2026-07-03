import { Router } from 'express';
import { db } from '../db/client';
import { detectEmaCrossSetups } from '../engine/evaluators/ema-cross';
import { getPipSize } from '../engine/pip-size';
import type { Candle } from '../engine/indicators/ema';

const router = Router();

const MAX_CANDLES = 1000;

// Levels (ECC/EMA/EVL/MHL) of the latest EMA-cross setup for a symbol/timeframe,
// computed live from recent candles. Used by the New Trade panel to show the
// current setup's levels and their distance to the live price for precise SLs.
router.get('/', async (req, res) => {
  const { broker, symbol, tf, emaFast, emaSlow } = req.query as Record<string, string>;

  if (!broker || !symbol || !tf || !emaFast || !emaSlow) {
    res.status(400).json({ message: 'broker, symbol, tf, emaFast and emaSlow are required' });
    return;
  }
  const fast = parseInt(emaFast, 10);
  const slow = parseInt(emaSlow, 10);
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast <= 0 || slow <= 0 || fast === slow) {
    res.status(400).json({ message: 'emaFast and emaSlow must be positive integers and differ' });
    return;
  }

  const rows = await db.candle.findMany({
    where: { broker, symbol, timeframe: tf },
    orderBy: { time: 'desc' },
    take: MAX_CANDLES,
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length < Math.max(fast, slow) + 5) {
    res.json({ setup: null });
    return;
  }
  const candles = rows.reverse() as Candle[];
  const pip = getPipSize(symbol);

  const setups = detectEmaCrossSetups(candles, { emaFast: fast, emaSlow: slow, direction: 'both' }, pip);
  if (setups.length === 0) {
    res.json({ setup: null });
    return;
  }
  const last = setups[setups.length - 1];
  res.json({
    setup: {
      direction: last.direction,
      activationTime: last.activationTime.toISOString(),
      levels: last.levels, // { ECC, EMA, EVL, MHL }
      pipSize: pip,
    },
  });
});

export default router;
