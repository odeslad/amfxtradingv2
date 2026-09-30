import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';

const router = Router();

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const record = await db.chartIndicators.findUnique({ where: { userId: req.userId! } });
  res.json({ emas: record?.emas ?? [] });
}));

router.put('/', asyncRoute<AuthRequest>(async (req, res) => {
  const { emas } = req.body as { emas: object };
  const record = await db.chartIndicators.upsert({
    where:  { userId: req.userId! },
    update: { emas },
    create: { userId: req.userId!, emas },
  });
  res.json({ emas: record.emas });
}));

export default router;
