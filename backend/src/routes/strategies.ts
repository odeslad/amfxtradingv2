import { Router } from 'express';
import { db } from '../db/client';
import { runBacktest } from '../services/backtest';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const strategies = await db.strategy.findMany({ orderBy: { id: 'desc' } });
    res.json(strategies);
  } catch (err) {
    console.error('[STRATEGIES] LIST failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { broker, symbol, timeframe, config } = req.body as {
      broker: string; symbol: string; timeframe: string; config: unknown;
    };

    if (!broker || !symbol || !timeframe || !config) {
      res.status(400).json({ error: 'broker, symbol, timeframe and config are required' });
      return;
    }

    const strategy = await db.strategy.create({
      data: { broker, symbol, timeframe, config },
    });

    runBacktest(strategy.id).catch((err) =>
      console.error(`[BACKTEST] strategy=${strategy.id} failed:`, err),
    );

    res.status(201).json(strategy);
  } catch (err) {
    console.error('[STRATEGIES] POST failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'], 10);
    const strategy = await db.strategy.findUnique({ where: { id } });
    if (!strategy) { res.status(404).json({ error: 'Strategy not found' }); return; }
    res.json(strategy);
  } catch (err) {
    console.error('[STRATEGIES] GET failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'], 10);
    const { config, active } = req.body as { config?: unknown; active?: boolean };

    const strategy = await db.strategy.update({
      where: { id },
      data: {
        ...(config !== undefined && { config: config as object }),
        ...(active !== undefined && { active }),
      },
    });

    if (config !== undefined) {
      runBacktest(strategy.id).catch((err) =>
        console.error(`[BACKTEST] strategy=${strategy.id} re-run failed:`, err),
      );
    }

    res.json(strategy);
  } catch (err) {
    console.error('[STRATEGIES] PUT failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'], 10);

    await db.$transaction(async (tx) => {
      const runs = await tx.backtestRun.findMany({ where: { strategyId: id }, select: { id: true } });
      const runIds = runs.map((r) => r.id);

      if (runIds.length > 0) {
        const setups = await tx.backtestSetup.findMany({ where: { runId: { in: runIds } }, select: { id: true } });
        const setupIds = setups.map((s) => s.id);

        if (setupIds.length > 0) {
          await tx.backtestTrade.deleteMany({ where: { setupId: { in: setupIds } } });
        }
        await tx.backtestSetup.deleteMany({ where: { runId: { in: runIds } } });
        await tx.backtestRun.deleteMany({ where: { strategyId: id } });
      }

      await tx.strategy.delete({ where: { id } });
    });

    res.status(204).end();
  } catch (err) {
    console.error('[STRATEGIES] DELETE failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/backtest', async (req, res) => {
  try {
    const id = parseInt(req.params['id'], 10);
    const { from, to } = req.query as { from?: string; to?: string };

    const runs = await db.backtestRun.findMany({
      where: { strategyId: id },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        setups: {
          where: {
            ...(from && { activationTime: { gte: new Date(from) } }),
            ...(to && { activationTime: { lte: new Date(to) } }),
          },
          include: { trades: true },
        },
      },
    });

    res.json(runs[0] ?? null);
  } catch (err) {
    console.error('[STRATEGIES] GET backtest failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
