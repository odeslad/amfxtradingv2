import { Router } from 'express';
import { getAllPositions } from '../store/positions';
import { setColor, getAllColors } from '../store/positionColors';

const router = Router();

router.get('/live', async (_req, res) => {
  const colors = await getAllColors();
  const brokers = getAllPositions();
  const enriched = brokers.map(({ broker, positions, ...rest }) => ({
    broker,
    ...rest,
    positions: (positions as { ticket: number }[]).map(p => ({
      ...p,
      color: colors.get(`${broker}:${p.ticket}`) ?? '',
    })),
  }));
  res.json(enriched);
});

router.patch('/color', async (req, res) => {
  const { broker, ticket, color } = req.body as { broker: string; ticket: number; color: string };
  if (!broker || ticket == null) {
    res.status(400).json({ error: 'broker and ticket are required' });
    return;
  }
  await setColor(broker, ticket, color ?? '');
  res.json({ ok: true });
});

export default router;
