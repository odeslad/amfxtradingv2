import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery, intParam, dateParam } from '../middleware/parse';

const router = Router();

const MAX_LIMIT = 1000;

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const symbol = singleQuery(req.query, 'symbol');
  const from = dateParam(singleQuery(req.query, 'from'), 'from');
  const to = dateParam(singleQuery(req.query, 'to'), 'to');
  const take = intParam(singleQuery(req.query, 'limit'), 'limit', { min: 0, max: MAX_LIMIT, default: 200, clamp: true });
  const skip = intParam(singleQuery(req.query, 'offset'), 'offset', { min: 0, default: 0 });

  const [trades, balances] = await Promise.all([
    db.trade.findMany({
      where: {
        ...(broker ? { broker } : {}),
        ...(symbol ? { symbol } : {}),
        ...(from || to ? {
          closeTime: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        } : {}),
      },
      orderBy: { closeTime: 'desc' },
      take,
      skip,
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
