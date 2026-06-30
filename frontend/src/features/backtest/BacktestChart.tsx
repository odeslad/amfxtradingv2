import { useMemo } from 'react';
import { LightweightChart } from '../chart/LightweightChart';
import { ChartErrorBoundary } from '../chart/ChartErrorBoundary';
import type { Ema } from '../chart/chart.types';
import { useBacktestCandles } from './useBacktestCandles';

interface Props {
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
}

export function BacktestChart({ broker, symbol, timeframe, emaFast, emaSlow }: Props) {
  const { candles, loadMore, hasMore } = useBacktestCandles(broker, symbol, timeframe);

  const emas = useMemo<Ema[]>(() => [
    { id: 'fast', period: emaFast, color: '#4caf84', style: 'solid', width: 1 },
    { id: 'slow', period: emaSlow, color: '#3a7bd5', style: 'solid', width: 1 },
  ], [emaFast, emaSlow]);

  return (
    <ChartErrorBoundary resetKey={`${broker}-${symbol}-${timeframe}`}>
      <LightweightChart
        candles={candles}
        broker={broker}
        symbol={symbol}
        timeframe={timeframe}
        emas={emas}
        onLoadMore={hasMore ? loadMore : undefined}
      />
    </ChartErrorBoundary>
  );
}
