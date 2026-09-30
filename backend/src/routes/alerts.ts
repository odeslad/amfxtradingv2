import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { refreshAlerts } from '../alerts/alert-store';
import { asyncRoute } from '../middleware/asyncRoute';

const router = Router();

type Direction = 'above' | 'below';

interface AlertBody {
  broker?: string;
  symbol?: string;
  price?: number;
  direction?: Direction;
  note?: string | null;
  enabled?: boolean;
}

// Per-field rules shared by the full (POST) and partial (PUT) validation.
const FIELD_RULES: Record<keyof AlertBody, (v: unknown) => string | null> = {
  broker: v => (typeof v === 'string' && v !== '' ? null : 'broker must be a non-empty string'),
  symbol: v => (typeof v === 'string' && v !== '' ? null : 'symbol must be a non-empty string'),
  price: v => (typeof v === 'number' && Number.isFinite(v) ? null : 'price must be a number'),
  direction: v => (v === 'above' || v === 'below' ? null : 'direction must be "above" or "below"'),
  note: v => (v === null || typeof v === 'string' ? null : 'note must be a string or null'),
  enabled: v => (typeof v === 'boolean' ? null : 'enabled must be a boolean'),
};

function validate(body: AlertBody): string | null {
  if (!body.broker || !body.symbol) return 'broker and symbol are required';
  if (typeof body.price !== 'number' || !Number.isFinite(body.price)) return 'price must be a number';
  if (body.direction !== 'above' && body.direction !== 'below') return 'direction must be "above" or "below"';
  return validatePartial(body);
}

function validatePartial(body: AlertBody): string | null {
  for (const [field, rule] of Object.entries(FIELD_RULES) as [keyof AlertBody, (v: unknown) => string | null][]) {
    if (body[field] === undefined) continue;
    const error = rule(body[field]);
    if (error) return error;
  }
  return null;
}

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const alerts = await db.priceAlert.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json(alerts);
}));

router.post('/', asyncRoute<AuthRequest>(async (req, res) => {
  const body = req.body as AlertBody;
  const error = validate(body);
  if (error) { res.status(400).json({ message: error }); return; }

  const alert = await db.priceAlert.create({
    data: {
      userId: req.userId!,
      broker: body.broker!,
      symbol: body.symbol!,
      price: body.price!,
      direction: body.direction!,
      note: body.note ?? null,
    },
  });
  await refreshAlerts();
  res.status(201).json(alert);
}));

router.put('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const body = req.body as AlertBody;
  const error = validatePartial(body);
  if (error) { res.status(400).json({ message: error }); return; }

  const existing = await db.priceAlert.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) { res.status(404).json({ message: 'alert not found' }); return; }

  // re-arming (enabled true) clears the previous trigger so it can fire again
  const reArmed = body.enabled === true && !existing.enabled;

  const alert = await db.priceAlert.update({
    where: { id },
    data: {
      ...(body.broker !== undefined ? { broker: body.broker } : {}),
      ...(body.symbol !== undefined ? { symbol: body.symbol } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.direction !== undefined ? { direction: body.direction } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(reArmed ? { triggeredAt: null } : {}),
    },
  });
  await refreshAlerts();
  res.json(alert);
}));

router.delete('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: 'invalid id' }); return; }

  const result = await db.priceAlert.deleteMany({ where: { id, userId: req.userId! } });
  if (result.count === 0) { res.status(404).json({ message: 'alert not found' }); return; }
  await refreshAlerts();
  res.status(204).end();
}));

export default router;
