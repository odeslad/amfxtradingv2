import { useMemo } from 'react';
import { LightweightChart, type BacktestOverlay, type BacktestOverlayLayers } from '../chart/LightweightChart';
import { ChartErrorBoundary } from '../chart/ChartErrorBoundary';
import type { Ema } from '../chart/chart.types';
import type { BacktestSetup } from './backtest.types';
import { useBacktestCandles } from './useBacktestCandles';

interface Props {
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  setups: BacktestSetup[];
  layers: BacktestOverlayLayers;
}

export function BacktestChart({ broker, symbol, timeframe, emaFast, emaSlow, setups, layers }: Props) {
  const { candles, loadMore, hasMore } = useBacktestCandles(broker, symbol, timeframe);

  const emas = useMemo<Ema[]>(() => [
    { id: 'fast', period: emaFast, color: '#4caf84', style: 'solid', width: 1 },
    { id: 'slow', period: emaSlow, color: '#3a7bd5', style: 'solid', width: 1 },
  ], [emaFast, emaSlow]);

  const overlay = useMemo<BacktestOverlay>(() => ({
    layers,
    setups: setups.map((s, i) => ({
      id: i + 1,
      direction: s.direction,
      activationTime: s.activationTime,
      closeTime: s.closeTime,
      levels: s.levels,
      trades: s.trades.map(t => ({
        direction: s.direction,
        entryTime: t.entryTime,
        entryPrice: t.entryPrice,
        exitTime: t.exitTime,
        exitPrice: t.exitPrice,
        sl: t.sl,
        tp: t.tp,
        status: t.status,
        reason: t.reason,
      })),
    })),
  }), [setups, layers]);

  return (
    <ChartErrorBoundary resetKey={`${broker}-${symbol}-${timeframe}`}>
      <LightweightChart
        candles={candles}
        broker={broker}
        symbol={symbol}
        timeframe={timeframe}
        emas={emas}
        backtestOverlay={overlay}
        onLoadMore={hasMore ? loadMore : undefined}
      />
    </ChartErrorBoundary>
  );
}
