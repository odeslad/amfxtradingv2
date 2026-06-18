import crypto from 'crypto';
import { db } from '../db/client';
import { detectEmaCrossSetups } from '../engine/evaluators/ema-cross';
import type { EmaCrossContext } from '../engine/evaluators/ema-cross';
import type { Candle } from '../engine/indicators/ema';

interface StrategyForm {
  id?: string;
  name?: string;
  contextType: string;
  context: EmaCrossContext;
  instrument: string;
  timeframe: string;
}

interface StrategyConfig {
  forms: StrategyForm[];
}

export async function runBacktest(strategyId: number): Promise<void> {
  const strategy = await db.strategy.findUnique({ where: { id: strategyId } });
  if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

  const config = strategy.config as unknown as StrategyConfig;
  const configForHash = { forms: config.forms.map(({ id: _id, name: _name, ...rest }) => rest) };
  const configHash = crypto.createHash('md5').update(JSON.stringify(configForHash)).digest('hex');

  for (const form of config.forms) {
    if (form.contextType !== 'ema_cross') continue;

    const symbol = form.instrument;
    const timeframe = normalizeTimeframe(form.timeframe);

    const lastRun = await db.backtestRun.findFirst({
      where: { strategyId, broker: strategy.broker, symbol, timeframe, configHash },
      orderBy: { createdAt: 'desc' },
    });

    if (lastRun) {
      console.log(`[BACKTEST] strategy=${strategyId} ${symbol} ${timeframe} | cache hit — skipping`);
      continue;
    }

    const candles = await db.candle.findMany({
      where: { broker: strategy.broker, symbol, timeframe },
      orderBy: { time: 'asc' },
    });

    if (candles.length === 0) {
      console.log(`[BACKTEST] strategy=${strategyId} ${symbol} ${timeframe} | no candles in DB`);
      continue;
    }

    const dateFrom = candles[0].time;
    const dateTo = candles[candles.length - 1].time;

    console.log(`[BACKTEST] strategy=${strategyId} ${symbol} ${timeframe} | evaluating ${candles.length} candles`);

    const setups = detectEmaCrossSetups(candles as Candle[], form.context);

    const run = await db.backtestRun.create({
      data: { strategyId, broker: strategy.broker, symbol, timeframe, dateFrom, dateTo, configHash },
    });

    for (const setup of setups) {
      await db.backtestSetup.create({
        data: {
          runId: run.id,
          direction: setup.direction,
          activationTime: setup.activationTime,
          activationPrice: setup.activationPrice,
          closeTime: setup.closeTime,
          closePrice: setup.closePrice,
          levels: setup.levels as object,
          candleCount: setup.candleCount,
          weakCandles: setup.weakCandles,
          strongCandles: setup.strongCandles,
          mfePrice: setup.mfePrice,
          mfeTime: setup.mfeTime,
          maePrice: setup.maePrice,
          maeTime: setup.maeTime,
        },
      });
    }

    console.log(`[BACKTEST] strategy=${strategyId} ${symbol} ${timeframe} | done | setups=${setups.length}`);
  }
}

function normalizeTimeframe(tf: string): string {
  const map: Record<string, string> = {
    M5: 'M5', M15: 'M15', H1: 'H1', H4: 'H4', D1: 'D1',
  };
  return map[tf] ?? tf;
}
