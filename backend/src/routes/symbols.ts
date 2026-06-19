import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req, res) => {
  const { broker } = req.query;

  const where = broker ? { broker: String(broker) } : {};

  const rows = await db.candle.findMany({
    where,
    distinct: ['symbol'],
    select: { symbol: true },
    orderBy: { symbol: 'asc' },
  });

  res.json(rows.map(r => r.symbol));
});

export default router;
