import crypto from 'crypto';
import { db } from '../db/client';
import { evaluateSetups } from '../engine/evaluators/setup-evaluator';
import { evaluateEntries } from '../engine/evaluators/entry-evaluator';
import type { EntryConfig } from '../engine/evaluators/entry-evaluator';
import type { EmaCrossContext } from '../engine/evaluators/ema-cross';
import { getPipSize } from '../engine/pip-size';
import type { Candle } from '../engine/indicators/ema';

interface StrategyForm {
  id?: string;
  name?: string;
  instrument: string;
  timeframe: string;
  setup: EmaCrossContext & { type: string };
  entries: EntryConfig[];
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
    if (form.setup.type !== 'ema_cross') continue;

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

    const pipSize = getPipSize(symbol);
    const setups = evaluateSetups(candles as Candle[], form, pipSize);

    const run = await db.backtestRun.create({
      data: { strategyId, broker: strategy.broker, symbol, timeframe, dateFrom, dateTo, configHash },
    });

    for (const setup of setups) {
      const savedSetup = await db.backtestSetup.create({
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
          pivots: setup.pivots as object[],
          mfePrice: setup.mfePrice,
          mfeTime: setup.mfeTime,
          maePrice: setup.maePrice,
          maeTime: setup.maeTime,
        },
      });

      if (form.entries.length > 0) {
        const trades = evaluateEntries(
          candles as Candle[],
          setup.direction,
          setup.activationIndex,
          setup.closeIndex,
          setup.levels,
          form.entries,
          pipSize,
          setup.weakCandles,
          setup.strongCandles,
          setup.pivots,
        );

        for (const trade of trades) {
          await db.backtestTrade.create({
            data: {
              setupId: savedSetup.id,
              entryType: trade.entryType,
              entryPrice: trade.entryPrice,
              sl: trade.sl,
              tp: trade.tp ?? 0,
              entryTime: trade.entryTime,
              exitTime: trade.exitTime,
              exitPrice: trade.exitPrice,
              resultPips: trade.resultPips,
              status: trade.status,
              reason: trade.reason,
            },
          });
        }
      }
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
