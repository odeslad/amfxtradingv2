import { Router, type Response } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { broker, symbol, from, to, limit = '200', offset = '0' } = req.query as Record<string, string>;

  const [trades, balances] = await Promise.all([
    db.trade.findMany({
      where: {
        ...(broker ? { broker } : {}),
        ...(symbol ? { symbol } : {}),
        ...(from || to ? {
          closeTime: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      orderBy: { closeTime: 'desc' },
      take: Math.min(parseInt(limit), 1000),
      skip: parseInt(offset),
    }),
    db.balance.findMany({
      distinct: ['broker'],
      orderBy: { timestamp: 'desc' },
      select: { broker: true, currency: true },
    }),
  ]);

  const currencyByBroker = new Map(balances.map(b => [b.broker, b.currency]));
  const enriched = trades.map(t => ({ ...t, currency: currencyByBroker.get(t.broker) ?? '' }));

  res.json(enriched);
});

export default router;
