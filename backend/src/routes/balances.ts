import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { getAllPositions } from '../store/positions';
import { isPipeLive, pipeStateOf } from '../store/liveness';
import { asyncRoute } from '../middleware/asyncRoute';

const router = Router();

router.get('/', asyncRoute<AuthRequest>(async (_req, res) => {
  const brokers = await db.balance.findMany({
    distinct: ['broker'],
    orderBy: { timestamp: 'desc' },
    // `day` is an internal key; the response keeps today's shape.
    select: {
      id: true, broker: true, balance: true, equity: true, profit: true, margin: true,
      freeMargin: true, leverage: true, currency: true, name: true, number: true, timestamp: true,
    },
  });

  res.json(brokers);
}));

// Day P&L per broker: net P&L of trades closed today (broker time) plus the live
// floating P&L of currently open positions.
router.get('/daily-pnl', asyncRoute<AuthRequest>(async (_req, res) => {
  const liveByBroker = getAllPositions();
  const result: Record<string, number> = {};

  for (const { broker, positions, brokerOffset } of liveByBroker) {
    // The positions store keeps the last entry forever; a broker whose EA is
    // gone is left out so the Accounts row turns inactive.
    if (!isPipeLive(pipeStateOf(broker) ?? 'connected')) continue;
    // start of today in broker time, expressed as a UTC instant
    const nowBrokerMs = Date.now() + brokerOffset * 1000;
    const brokerMidnight = new Date(nowBrokerMs);
    brokerMidnight.setUTCHours(0, 0, 0, 0);
    const dayStartUtc = new Date(brokerMidnight.getTime() - brokerOffset * 1000);

    const closed = await db.trade.aggregate({
      where: { broker, closeTime: { gte: dayStartUtc } },
      _sum: { profit: true, swap: true, commission: true },
    });
    const closedNet = (closed._sum.profit ?? 0) + (closed._sum.swap ?? 0) + (closed._sum.commission ?? 0);

    const floating = (positions as { profit?: number; swap?: number; commission?: number }[])
      .reduce((sum, p) => sum + (p.profit ?? 0) + (p.swap ?? 0) + (p.commission ?? 0), 0);

    result[broker] = closedNet + floating;
  }

  res.json(result);
}));

export default router;
