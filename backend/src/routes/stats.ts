import { Router, type Response } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { computeBrokerStats } from '../services/stats';

const router = Router();

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { broker, from, to } = req.query as Record<string, string | undefined>;

  const known = broker
    ? await db.balance.findFirst({ where: { broker }, select: { id: true } })
    : null;
  if (!broker || !known) {
    res.status(400).json({ error: 'unknown broker' });
    return;
  }

  res.json(await computeBrokerStats(broker, parseDate(from), parseDate(to)));
});

export default router;
