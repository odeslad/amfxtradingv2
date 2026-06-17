import { db } from '../db/client';
import type { CandleCloseEvent } from './candle-tracker';

export interface EvaluationResult {
  strategyId: number;
  action: 'buy' | 'sell';
  lots: number;
  sl: number;
  tp: number;
}

export async function evaluateStrategies(
  broker: string,
  event: CandleCloseEvent,
): Promise<EvaluationResult[]> {
  const strategies = await db.strategy.findMany({
    where: { broker, symbol: event.symbol, timeframe: event.timeframe, active: true },
  });

  if (strategies.length === 0) return [];

  // TODO: implement strategy evaluation logic per strategy config
  return [];
}
