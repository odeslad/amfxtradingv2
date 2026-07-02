import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { refreshEmaAlerts } from '../alerts/ema-alert-store';

const router = Router();

type Direction = 'buy' | 'sell' | 'both';

interface EmaAlertBody {
  broker?: string;
  symbol?: string;
  timeframe?: string;
  emaFast?: number;
  emaSlow?: number;
  direction?: Direction;
  thresholdPips?: number;
  note?: string | null;
  enabled?: boolean;
}

function validate(body: EmaAlertBody): string | null {
  if (!body.broker || !body.symbol || !body.timeframe) return 'broker, symbol and timeframe are required';
  if (!Number.isInteger(body.emaFast) || !Number.isInteger(body.emaSlow)) return 'emaFast and emaSlow must be integers';
  if ((body.emaFast as number) <= 0 || (body.emaSlow as number) <= 0) return 'emaFast and emaSlow must be positive';
  if (body.emaFast === body.emaSlow) return 'emaFast and emaSlow must differ';
  if (body.direction !== 'buy' && body.direction !== 'sell' && body.direction !== 'both') return 'direction must be "buy", "sell" or "both"';
  if (typeof body.thresholdPips !== 'number' || !Number.isFinite(body.thresholdPips) || body.thresholdPips <= 0) return 'thresholdPips must be a positive number';
  return null;
}

router.get('/', async (req: AuthRequest, res) => {
  const alerts = await db.emaCrossAlert.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json(alerts);
});

router.post('/', async (req: AuthRequest, res) => {
  const body = req.body as EmaAlertBody;
  const error = validate(body);
  if (error) { res.status(400).json({ message: error }); return; }

  const alert = await db.emaCrossAlert.create({
    data: {
      userId: req.userId!,
      broker: body.broker!,
      symbol: body.symbol!,
      timeframe: body.timeframe!,
      emaFast: body.emaFast!,
      emaSlow: body.emaSlow!,
      direction: body.direction!,
      thresholdPips: body.thresholdPips!,
      note: body.note ?? null,
    },
  });
  await refreshEmaAlerts();
  res.status(201).json(alert);
});

router.put('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const existing = await db.emaCrossAlert.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) { res.status(404).json({ message: 'alert not found' }); return; }

  const body = req.body as EmaAlertBody;
  // re-arming (enabled true) clears the previous trigger so it can fire again
  const reArmed = body.enabled === true && !existing.enabled;

  const alert = await db.emaCrossAlert.update({
    where: { id },
    data: {
      ...(body.broker !== undefined ? { broker: body.broker } : {}),
      ...(body.symbol !== undefined ? { symbol: body.symbol } : {}),
      ...(body.timeframe !== undefined ? { timeframe: body.timeframe } : {}),
      ...(body.emaFast !== undefined ? { emaFast: body.emaFast } : {}),
      ...(body.emaSlow !== undefined ? { emaSlow: body.emaSlow } : {}),
      ...(body.direction !== undefined ? { direction: body.direction } : {}),
      ...(body.thresholdPips !== undefined ? { thresholdPips: body.thresholdPips } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(reArmed ? { triggeredAt: null } : {}),
    },
  });
  await refreshEmaAlerts();
  res.json(alert);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const result = await db.emaCrossAlert.deleteMany({ where: { id, userId: req.userId! } });
  if (result.count === 0) { res.status(404).json({ message: 'alert not found' }); return; }
  await refreshEmaAlerts();
  res.status(204).end();
});

export default router;
