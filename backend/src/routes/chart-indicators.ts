import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  const record = await db.chartIndicators.findUnique({ where: { userId: req.userId! } });
  res.json({ emas: record?.emas ?? [] });
});

router.put('/', async (req: AuthRequest, res) => {
  const { emas } = req.body as { emas: unknown };
  const record = await db.chartIndicators.upsert({
    where:  { userId: req.userId! },
    update: { emas },
    create: { userId: req.userId!, emas },
  });
  res.json({ emas: record.emas });
});

export default router;
