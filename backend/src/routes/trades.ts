import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const symbol = singleQuery(req.query, 'symbol');
  const from = singleQuery(req.query, 'from');
  const to = singleQuery(req.query, 'to');
  const limit = singleQuery(req.query, 'limit') ?? '200';
  const offset = singleQuery(req.query, 'offset') ?? '0';

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
}));

export default router;
