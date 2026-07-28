import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req, res) => {
  const { broker } = req.query;

  const where = broker ? { broker: String(broker) } : {};

  // groupBy runs DISTINCT in SQL; findMany+distinct would load every candle
  // row into memory and dedupe in JS, which OOMs the process on this table.
  const rows = await db.candle.groupBy({
    by: ['symbol'],
    where,
    orderBy: { symbol: 'asc' },
  });

  res.json(rows.map(r => r.symbol));
});

export default router;
