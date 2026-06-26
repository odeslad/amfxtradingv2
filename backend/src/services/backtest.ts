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
  const exec = crypto.randomBytes(4).toString('hex');
  const t0 = Date.now();
  console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} | START`);

  const strategy = await db.strategy.findUnique({ where: { id: strategyId } });
  if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

  const config = strategy.config as unknown as StrategyConfig;
  const configForHash = { forms: config.forms.map(({ id: _id, name: _name, ...rest }) => rest) };
  const configHash = crypto.createHash('md5').update(stableStringify(configForHash)).digest('hex');
  console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} | configHash=${configHash}`);

  for (const form of config.forms) {
    if (form.setup.type !== 'ema_cross') continue;

    const symbol = form.instrument;
    const timeframe = normalizeTimeframe(form.timeframe);

    const candles = await db.candle.findMany({
      where: { broker: strategy.broker, symbol, timeframe },
      orderBy: { time: 'asc' },
    });

    if (candles.length === 0) {
      console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} ${symbol} ${timeframe} | no candles in DB`);
      continue;
    }

    const dateFrom = candles[0].time;
    const dateTo = candles[candles.length - 1].time;

    const pipSize = getPipSize(symbol);
    const setups = evaluateSetups(candles as Candle[], form, pipSize);

    console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} ${symbol} ${timeframe} | candles=${candles.length} [${dateFrom.toISOString()} → ${dateTo.toISOString()}] | setups=${setups.length}`);

    await deleteRuns(strategyId, strategy.broker, symbol, timeframe);

    const run = await db.backtestRun.create({
      data: { strategyId, broker: strategy.broker, symbol, timeframe, dateFrom, dateTo, configHash },
    });
    console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} ${symbol} ${timeframe} | created run=${run.id}`);

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

    console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} ${symbol} ${timeframe} | done run=${run.id} | setups=${setups.length}`);
  }

  console.log(`[BACKTEST] exec=${exec} strategy=${strategyId} | END (${Date.now() - t0}ms)`);
}

async function deleteRuns(strategyId: number, broker: string, symbol: string, timeframe: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const runs = await tx.backtestRun.findMany({
      where: { strategyId, broker, symbol, timeframe },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);
    if (runIds.length === 0) return;

    const setups = await tx.backtestSetup.findMany({ where: { runId: { in: runIds } }, select: { id: true } });
    const setupIds = setups.map((s) => s.id);

    if (setupIds.length > 0) {
      await tx.backtestTrade.deleteMany({ where: { setupId: { in: setupIds } } });
    }
    await tx.backtestSetup.deleteMany({ where: { runId: { in: runIds } } });
    await tx.backtestRun.deleteMany({ where: { id: { in: runIds } } });
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

function normalizeTimeframe(tf: string): string {
  const map: Record<string, string> = {
    M5: 'M5', M15: 'M15', H1: 'H1', H4: 'H4', D1: 'D1',
  };
  return map[tf] ?? tf;
}
