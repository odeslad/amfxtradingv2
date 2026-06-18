import { Router, type Response } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const positions = await db.position.findMany({
    orderBy: [{ broker: 'asc' }, { openTime: 'asc' }],
  });
  res.json(positions);
});

export default router;
