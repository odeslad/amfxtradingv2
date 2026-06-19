import { Router, type Response } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { broker, symbol, from, to, limit = '200', offset = '0' } = req.query as Record<string, string>;

  const trades = await db.trade.findMany({
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
  });

  res.json(trades);
});

export default router;
