import { Router, type Response } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const brokers = await db.balance.findMany({
    distinct: ['broker'],
    orderBy: { timestamp: 'desc' },
  });

  res.json(brokers);
});

export default router;
