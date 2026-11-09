import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch, apiSend, isAbortError } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import type { PriceAlert } from '../../lib/useAlerts';
import { ChartToolbar, type PositionsMode } from './ChartToolbar';
import { AlertActionBar } from './AlertActionBar';
import { LightweightChart, type ChartHandle, type DrawMode } from './LightweightChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import type { PersistedDrawing, TrendlineAppearance } from './DrawingTools';
import type { Ema } from './chart.types';
import type { EmaTradesSettings } from './emaTrades';
import { useEmaCrossTrades } from './useEmaCrossTrades';
import { useChartToolState, type ChartSide } from './useChartToolState';
import { isBuySide, type PnlMode, type Position } from '../journal/utils/position';
import styles from './ChartSlot.module.css';

export type { ChartSide } from './useChartToolState';

interface ChartSlotProps {
  side: ChartSide;
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  brokerHidden: boolean;
  symbolHidden: boolean;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  timeframe: string;
  onTimeframeChange: (v: string) => void;
  positions: Position[];
  balance?: number;
  emas: Ema[];
  trendlineAppearance: TrendlineAppearance;
  showSpread: boolean;
  pnlMode: PnlMode;
  emaTradesSettings: EmaTradesSettings;
  alerts: PriceAlert[];
  onMoveAlert: (id: number, price: number) => Promise<void>;
  onEditAlertPrice: (alert: PriceAlert) => void;
  onToggleAlert: (alert: PriceAlert) => void;
  onDeleteAlert: (alert: PriceAlert) => void;
  onIndicators: () => void;
  onFilters: () => void;
  onAlerts: () => void;
  alertsActive: boolean;
  alertsFlashing: boolean;
  onNewTrade: (timeframe: string) => void;
  onEditPosition: (ticket: number) => void;
  onClosePosition: (ticket: number) => void;
  onModifyPosition: (ticket: number, sl: number, tp: number) => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  splitAvailable?: boolean;
  splitActive?: boolean;
  onSplit?: () => void;
}

interface RawCandle {
  openTime: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const POSITIONS_MODE_CYCLE: Record<PositionsMode, PositionsMode> = {
  none: 'all',
  all: 'buys',
  buys: 'sells',
  sells: 'none',
};

const TF_KEYS: Record<string, { time: string; open: string; high: string; low: string }> = {
  M5:  { time: 'm5_time',  open: 'm5_open',  high: 'm5_high',  low: 'm5_low'  },
  M15: { time: 'm15_time', open: 'm15_open', high: 'm15_high', low: 'm15_low' },
  H1:  { time: 'h1_time',  open: 'h1_open',  high: 'h1_high',  low: 'h1_low'  },
  H4:  { time: 'h4_time',  open: 'h4_open',  high: 'h4_high',  low: 'h4_low'  },
  D1:  { time: 'd1_time',  open: 'd1_open',  high: 'd1_high',  low: 'd1_low'  },
};


const parseCandles = (data: RawCandle[]): Candle[] => {
  const parsed = data.map(c => ({
    time: Math.floor(new Date(c.openTime).getTime() / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  parsed.sort((a, b) => a.time - b.time);
  return parsed;
};

// One chart with everything bound to its own timeframe: candles, live candle,
// drawings, draw mode, lock, positions mode and the selected alert (spec 036).
export function ChartSlot({
  side, brokers, symbols, broker, symbol, brokerHidden, symbolHidden, onBrokerChange, onSymbolChange,
  timeframe, onTimeframeChange, positions, balance, emas, trendlineAppearance, showSpread, pnlMode, emaTradesSettings,
  alerts, onMoveAlert, onEditAlertPrice, onToggleAlert, onDeleteAlert,
  onIndicators, onFilters, onAlerts, alertsActive, alertsFlashing,
  onNewTrade, onEditPosition, onClosePosition, onModifyPosition, onFullscreen, isFullscreen,
  splitAvailable, splitActive, onSplit,
}: ChartSlotProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  // Live candle: pushed into the chart through its handle, never slot state (spec 019).
  const chartRef = useRef<ChartHandle>(null);
  const liveCandleRef = useRef<Candle | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  // Lock, EMA cross trades overlay and Positions mode: remembered per side (spec 040).
  const { locked, setLocked, emaTradesOn, setEmaTradesOn, positionsMode, setPositionsMode } = useChartToolState(side);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [drawings, setDrawings] = useState<PersistedDrawing[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [chartLoading, setChartLoading] = useState(() => Boolean(broker && symbol));
  const isLoadingMoreRef = useRef(false);
  const loadMoreAcRef = useRef<AbortController | null>(null);
  const hasMoreRef = useRef(true);
  const candlesRef = useRef<Candle[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { candlesRef.current = candles; }, [candles]);

  const chartAlerts = useMemo(
    () => alerts.map(a => ({ id: a.id, price: a.price, enabled: a.enabled, direction: a.direction })),
    [alerts],
  );
  const selectedAlert = selectedAlertId === null ? null : alerts.find(a => a.id === selectedAlertId) ?? null;

  useWs(useCallback((msg: unknown) => {
    const m = msg as {
      type: string;
      broker: string;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      symbol?: string;
      timeframe?: string;
      time?: number;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    };
    if (m.broker !== broker) return;

    // A candle closed on the tick stream (spec 025): merged like a REST row, so the
    // chart has it at the rollover instead of a poll later.
    if (m.type === 'candle') {
      if (m.symbol !== symbol || m.timeframe !== timeframe || m.time == null) return;
      const closed: Candle = { time: Math.floor(m.time), open: m.open ?? 0, high: m.high ?? 0, low: m.low ?? 0, close: m.close ?? 0 };
      setCandles(prev => {
        const idx = prev.findIndex(c => c.time === closed.time);
        if (idx !== -1) { const next = prev.slice(); next[idx] = closed; return next; }
        const next = [...prev, closed];
        return prev.length > 0 && prev[prev.length - 1].time > closed.time ? next.sort((a, b) => a.time - b.time) : next;
      });
      return;
    }

    if (m.type !== 'ticks' || !m.ticks) return;
    const keys = TF_KEYS[timeframe];
    if (!keys) return;
    const last = m.ticks.findLast((t) => t.symbol === symbol);
    if (!last) return;
    const candle: Candle = {
      time: last[keys.time],
      open: last[keys.open],
      high: last[keys.high],
      low: last[keys.low],
      close: last.bid,
    };
    liveCandleRef.current = candle;
    chartRef.current?.updateLive(candle, last.ask);
  }, [broker, symbol, timeframe]));

  // Selection changed: reset everything bound to it during render, before the
  // loading effects below start their requests.
  const selectionKey = `${broker}|${symbol}|${timeframe}`;
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey);
  if (selectionKey !== prevSelectionKey) {
    setPrevSelectionKey(selectionKey);
    setCandles([]);
    setDrawings(null);
    setHasMore(true);
    setChartLoading(Boolean(broker && symbol));
  }

  useEffect(() => {
    if (!broker || !symbol) return;
    hasMoreRef.current = true;
    // Selection changed: drop the previous live candle before the new history loads.
    liveCandleRef.current = null;
    chartRef.current?.updateLive(null);
    const ac = new AbortController();
    apiFetch<RawCandle[]>(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=2000`, { signal: ac.signal })
      .then(data => {
        setCandles(parseCandles(data));
        // keep the chart covered one more frame so the new data paints before
        // we reveal it, avoiding the brief flash of stale/flat candles
        requestAnimationFrame(() => requestAnimationFrame(() => setChartLoading(false)));
      })
      .catch(err => { if (!isAbortError(err)) setChartLoading(false); });
    return () => { ac.abort(); loadMoreAcRef.current?.abort(); };
  }, [broker, symbol, timeframe]);

  useEffect(() => {
    if (!broker || !symbol) return;
    const params = new URLSearchParams({ broker, symbol, timeframe });
    const ac = new AbortController();
    apiFetch<{ items: PersistedDrawing[] }>(`/drawings?${params.toString()}`, { signal: ac.signal })
      .then(data => setDrawings(data.items ?? []))
      .catch(err => { if (!isAbortError(err)) setDrawings([]); });
    return () => ac.abort();
  }, [broker, symbol, timeframe]);

  const saveDrawings = useCallback((items: PersistedDrawing[]) => {
    if (!broker || !symbol) return;
    apiSend('/drawings', 'PUT', { broker, symbol, timeframe, items }).catch(() => {});
  }, [broker, symbol, timeframe]);

  const handleDrawingsChange = useCallback((items: PersistedDrawing[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDrawings(items), 600);
  }, [saveDrawings]);

  const loadMoreCandles = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !broker || !symbol) return;
    const oldest = candlesRef.current[0]?.time;
    if (!oldest) return;
    isLoadingMoreRef.current = true;
    const ac = new AbortController();
    loadMoreAcRef.current = ac;
    apiFetch<RawCandle[]>(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=500&before=${oldest}`, { signal: ac.signal })
      .then(data => {
        if (data.length === 0) { hasMoreRef.current = false; setHasMore(false); return; }
        const parsed = parseCandles(data);
        setCandles(prev => [...parsed, ...prev]);
      })
      .catch(() => {})
      .finally(() => { isLoadingMoreRef.current = false; });
  }, [broker, symbol, timeframe]);

  const chartPositions = useMemo(() => {
    if (positionsMode === 'none') return [];
    return positions.filter(p =>
      p.symbol === symbol
      && (positionsMode === 'all' || (positionsMode === 'buys') === isBuySide(p.type)),
    );
  }, [positionsMode, positions, symbol]);

  const toggleDrawMode = useCallback((mode: DrawMode) => {
    setLocked(false);
    setDrawMode(prev => (prev === mode ? null : mode));
  }, [setLocked]);
  const toggleLock = useCallback(() => setLocked(prev => !prev), [setLocked]);
  const toggleEmaTrades = useCallback(() => setEmaTradesOn(prev => !prev), [setEmaTradesOn]);
  const lastClosedTime = candles.length > 0 ? candles[candles.length - 1].time : null;
  const emaCrossTrades = useEmaCrossTrades(emaTradesOn, broker, symbol, timeframe, emaTradesSettings, lastClosedTime);
  const clearDrawMode = useCallback(() => setDrawMode(null), []);
  const cyclePositions = useCallback(() => setPositionsMode(prev => POSITIONS_MODE_CYCLE[prev] ?? 'all'), [setPositionsMode]);
  // New Trade preselects the timeframe of the chart it was opened from (AC 7).
  const openNewTrade = useCallback(() => onNewTrade(timeframe), [onNewTrade, timeframe]);

  return (
    <div className={styles.slot}>
      <ChartToolbar
        brokers={brokers}
        symbols={symbols}
        broker={broker}
        symbol={symbol}
        brokerHidden={brokerHidden}
        symbolHidden={symbolHidden}
        timeframe={timeframe}
        onBrokerChange={onBrokerChange}
        onSymbolChange={onSymbolChange}
        onTimeframeChange={onTimeframeChange}
        onIndicators={onIndicators}
        onFilters={onFilters}
        drawMode={drawMode}
        onDrawMode={toggleDrawMode}
        onAlerts={onAlerts}
        alertsActive={alertsActive}
        alertsFlashing={alertsFlashing}
        locked={locked}
        onToggleLock={toggleLock}
        emaTradesActive={emaTradesOn}
        onToggleEmaTrades={toggleEmaTrades}
        onPositions={cyclePositions}
        positionsMode={positionsMode}
        onFullscreen={onFullscreen}
        isFullscreen={isFullscreen}
        splitAvailable={splitAvailable}
        splitActive={splitActive}
        onSplit={onSplit}
      />
      <div className={styles.slotChart}>
        {broker && symbol
          ? <ChartErrorBoundary resetKey={`${broker}-${symbol}-${timeframe}`}>
              <LightweightChart ref={chartRef} candles={candles} broker={broker} symbol={symbol} timeframe={timeframe} onLoadMore={hasMore ? loadMoreCandles : undefined} emas={emas} drawMode={drawMode} onDrawDone={clearDrawMode} positions={chartPositions} onEditPosition={onEditPosition} onClosePosition={onClosePosition} onModifyPosition={onModifyPosition} initialDrawings={drawings ?? undefined} onDrawingsChange={handleDrawingsChange} trendlineAppearance={trendlineAppearance} accountBalance={balance} pnlMode={pnlMode} showSpread={showSpread} alerts={chartAlerts} onMoveAlert={onMoveAlert} onSelectAlert={setSelectedAlertId} showNewTrade={positionsMode !== 'none'} onNewTrade={openNewTrade} locked={locked} emaCrossTrades={emaCrossTrades} />
              {chartLoading && <div className={styles.chartLoadingOverlay} />}
              {selectedAlert && (
                <AlertActionBar alert={selectedAlert} onEditPrice={onEditAlertPrice} onToggle={onToggleAlert} onDelete={onDeleteAlert} />
              )}
            </ChartErrorBoundary>
          : <div className={styles.empty}>Select a broker and symbol</div>
        }
      </div>
    </div>
  );
}
