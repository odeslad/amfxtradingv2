import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');

  const where = broker ? { broker } : {};

  // groupBy runs DISTINCT in SQL; findMany+distinct would load every candle
  // row into memory and dedupe in JS, which OOMs the process on this table.
  const rows = await db.candle.groupBy({
    by: ['symbol'],
    where,
    orderBy: { symbol: 'asc' },
  });

  res.json(rows.map(r => r.symbol));
}));

export default router;
