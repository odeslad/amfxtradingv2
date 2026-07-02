import { useEffect, useMemo } from 'react';
import { LightweightChart, type BacktestOverlay, type BacktestOverlayLayers } from '../chart/LightweightChart';
import { ChartErrorBoundary } from '../chart/ChartErrorBoundary';
import type { Ema } from '../chart/chart.types';
import type { BacktestSetup } from './backtest.types';
import { useBacktestCandles } from './useBacktestCandles';
import { useBacktestEmas } from './useBacktestEmas';

export interface FocusRange { from: number; to: number; nonce: number }

interface Props {
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  setups: BacktestSetup[];
  layers: BacktestOverlayLayers;
  focusRange: FocusRange | null;
}

export function BacktestChart({ broker, symbol, timeframe, emaFast, emaSlow, setups, layers, focusRange }: Props) {
  const { state, loadOlder, loadNewer, loadAround, hasOlder, hasNewer } = useBacktestCandles(broker, symbol, timeframe);
  const { candles, kind: candlesKind } = state;

  // Backend EMAs for the currently-loaded span (full-history accurate).
  const emaData = useBacktestEmas(
    broker, symbol, timeframe, emaFast, emaSlow,
    candles[0]?.time, candles[candles.length - 1]?.time,
  );

  // When a focus request arrives, load its candles. The range is passed straight
  // to the chart, which applies it as soon as the matching candles are present
  // (it retries on candle changes), so no manual re-emit is needed here.
  useEffect(() => {
    if (!focusRange) return;
    void loadAround(focusRange.from);
  }, [focusRange, loadAround]);

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
      weakCandles: s.weakCandles,
      strongCandles: s.strongCandles,
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
        slHistory: t.slHistory,
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
        focusRange={focusRange}
        candlesKind={candlesKind}
        emaData={emaData}
        onLoadMore={hasOlder ? loadOlder : undefined}
        onLoadNewer={hasNewer ? loadNewer : undefined}
        hasNewer={hasNewer}
      />
    </ChartErrorBoundary>
  );
}
