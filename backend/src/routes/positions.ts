import { Router } from 'express';
import { getAllPositions } from '../store/positions';
import { setColor, getAllColors } from '../store/positionColors';
import { getBid, getAsk } from '../store/ticks';
import { asyncRoute } from '../middleware/asyncRoute';

const router = Router();

router.get('/live', asyncRoute(async (_req, res) => {
  const colors = await getAllColors();
  const brokers = getAllPositions();
  const enriched = brokers.map(({ broker, positions, ...rest }) => ({
    broker,
    ...rest,
    positions: (positions as { ticket: number; symbol: string }[]).map(p => ({
      ...p,
      color: colors.get(`${broker}:${p.ticket}`) ?? '',
      currentBid: getBid(broker, p.symbol) ?? null,
      currentAsk: getAsk(broker, p.symbol) ?? null,
    })),
  }));
  res.json(enriched);
}));

router.patch('/color', asyncRoute(async (req, res) => {
  const { broker, ticket, color } = req.body as { broker: string; ticket: number; color: string };
  if (!broker || ticket == null) {
    res.status(400).json({ error: 'broker and ticket are required' });
    return;
  }
  await setColor(broker, ticket, color ?? '');
  res.json({ ok: true });
}));

export default router;
