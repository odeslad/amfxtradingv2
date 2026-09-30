import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { computeBrokerStats } from '../services/stats';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const from = singleQuery(req.query, 'from');
  const to = singleQuery(req.query, 'to');

  const known = broker
    ? await db.balance.findFirst({ where: { broker }, select: { id: true } })
    : null;
  if (!broker || !known) {
    res.status(400).json({ error: 'unknown broker' });
    return;
  }

  res.json(await computeBrokerStats(broker, parseDate(from), parseDate(to)));
}));

export default router;
