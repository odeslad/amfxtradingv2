import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, apiSend, errorMessage, isAbortError } from '../../lib/api';
import { modifyCommand, sendCommand } from '../../lib/commands';
import { addToast } from '../../lib/toast';
import { useWs } from '../../lib/useWs';
import { useAuth } from '../auth/useAuth';
import { playAlertBeep } from '../../lib/beep';
import { ChartToolbar } from './ChartToolbar';
import { ChartFiltersPanel } from './ChartFiltersPanel';
import { AlertsPanel } from './AlertsPanel';
import { useAlerts } from '../../lib/useAlerts';
import { useEmaAlerts } from '../../lib/useEmaAlerts';
import { LightweightChart } from './LightweightChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { isBrokerVisible, isSymbolVisible, useVisibility } from '../../lib/visibility';
import type { PersistedDrawing, TrendlineAppearance } from './DrawingTools';
import type { ChartHandle, DrawMode } from './LightweightChart';
import { IndicatorsPanel } from './IndicatorsPanel';
import { BulkEditPanel } from '../journal/BulkEditPanel';
import { ClosePositionPanel } from '../journal/ClosePositionPanel';
import { NewTradePanel } from '../journal/NewTradePanel';
import type { Ema } from './chart.types';
import { isBuySide, type Position } from '../journal/utils/position';
import type { PositionsMode } from './ChartToolbar';
import styles from './ChartPage.module.css';

const POSITIONS_MODE_CYCLE: Record<PositionsMode, PositionsMode> = {
  none: 'all',
  all: 'buys',
  buys: 'sells',
  sells: 'none',
};

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

// One string per positions list: setPositions only when something visible changed (spec 019).
const positionsSignature = (list: Position[]): string =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}`).join(';');

const TF_KEYS: Record<string, { time: string; open: string; high: string; low: string }> = {
  M5:  { time: 'm5_time',  open: 'm5_open',  high: 'm5_high',  low: 'm5_low'  },
  M15: { time: 'm15_time', open: 'm15_open', high: 'm15_high', low: 'm15_low' },
  H1:  { time: 'h1_time',  open: 'h1_open',  high: 'h1_high',  low: 'h1_low'  },
  H4:  { time: 'h4_time',  open: 'h4_open',  high: 'h4_high',  low: 'h4_low'  },
  D1:  { time: 'd1_time',  open: 'd1_open',  high: 'd1_high',  low: 'd1_low'  },
};

export function ChartPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // URL query params take precedence (deep links from the journal/legend);
  // otherwise fall back to the last selection persisted in localStorage.
  const [stored, setStored] = useLocalStorage('chart.selection', { broker: '', symbol: '', timeframe: 'H1' });
  const initBroker = searchParams.get('broker') ?? stored.broker;
  const initSymbol = searchParams.get('symbol') ?? stored.symbol;
  const initTimeframe = searchParams.get('timeframe') ?? stored.timeframe;

  const [allBrokers, setBrokers] = useState<string[]>([]);
  const [allSymbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState(initBroker);
  const [symbol, setSymbol] = useState(initSymbol);
  const [timeframe, setTimeframe] = useState(initTimeframe);

  // Hidden brokers / symbols (spec 024) leave the selectors; the current selection stays listed,
  // marked as hidden, until the operator picks another one (AC 5).
  const visibility = useVisibility();
  // The fetch effects read the visibility through a ref so a save does not refetch the lists.
  const visibilityRef = useRef(visibility);
  useEffect(() => { visibilityRef.current = visibility; }, [visibility]);
  const brokerHidden = !!broker && !isBrokerVisible(visibility, broker);
  const symbolHidden = !!broker && !!symbol && !isSymbolVisible(visibility, broker, symbol);
  const brokers = useMemo(() => {
    const list = allBrokers.filter(b => isBrokerVisible(visibility, b));
    return brokerHidden && allBrokers.includes(broker) ? [...list, broker] : list;
  }, [allBrokers, visibility, broker, brokerHidden]);
  const symbols = useMemo(() => {
    const list = allSymbols.filter(s => isSymbolVisible(visibility, broker, s));
    return symbolHidden && allSymbols.includes(symbol) ? [...list, symbol] : list;
  }, [allSymbols, visibility, broker, symbol, symbolHidden]);

  // Persist the current selection whenever it changes.
  useEffect(() => {
    setStored({ broker, symbol, timeframe });
  }, [broker, symbol, timeframe, setStored]);

  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [candles, setCandles] = useState<Candle[]>([]);
  // Live candle: pushed into the chart through its handle, never page state (spec 019).
  const chartRef = useRef<ChartHandle>(null);
  const liveCandleRef = useRef<Candle | null>(null);
  // Price shown by the alerts panel; fed only while the panel is open.
  const [panelPrice, setPanelPrice] = useState<number | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [newTradeOpen, setNewTradeOpen] = useState(false);
  const [alertFlash, setAlertFlash] = useState(false);
  const { user } = useAuth();
  const { alerts, refresh: refreshAlerts, create: createAlert, toggle: toggleAlert, remove: removeAlert } = useAlerts();
  const { alerts: emaAlerts, create: createEmaAlert, toggle: toggleEmaAlert, remove: removeEmaAlert } = useEmaAlerts();
  const chartAlerts = useMemo(
    () => alerts.filter(a => a.broker === broker && a.symbol === symbol).map(a => ({ id: a.id, price: a.price, enabled: a.enabled })),
    [alerts, broker, symbol],
  );
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [positionsMode, setPositionsMode] = useState<PositionsMode>('none');
  const [positions, setPositions] = useState<Position[]>([]);
  const positionsSigRef = useRef('');
  const acceptPositions = useCallback((list: Position[]) => {
    const sig = positionsSignature(list);
    if (sig === positionsSigRef.current) return;
    positionsSigRef.current = sig;
    setPositions(list);
  }, []);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [closePosition, setClosePosition] = useState<Position | null>(null);
  const [drawings, setDrawings] = useState<PersistedDrawing[] | null>(null);
  const [trendlineAppearance, setTrendlineAppearance] = useState<TrendlineAppearance>({ color: '#8c8c8c', style: 'dashed', width: 1 });
  const [hasMore, setHasMore] = useState(true);
  const [chartLoading, setChartLoading] = useState(() => Boolean(broker && symbol));
  const isLoadingMoreRef = useRef(false);
  const loadMoreAcRef = useRef<AbortController | null>(null);
  const hasMoreRef = useRef(true);
  const [emas, setEmas] = useState<Ema[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>([]);
  const emasRef = useRef<Ema[]>([]);

  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { emasRef.current = emas; }, [emas]);

  // iOS Safari (iPhone) has no Fullscreen API for arbitrary elements, so keep our
  // own state and fall back to a CSS fullscreen when the native API is missing.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenEnabled) setIsFullscreen(document.fullscreenElement === pageRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const nativeFullscreen = typeof document !== 'undefined'
    && document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function';

  const toggleFullscreen = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const canNative = document.fullscreenEnabled && typeof el.requestFullscreen === 'function';
    if (canNative) {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen();
    } else {
      // CSS fullscreen fallback for iPhone
      setIsFullscreen(prev => !prev);
    }
  }, []);

  // CSS fallback (iPhone): hide the app chrome (topbar + bottom nav) while
  // fullscreen, since `position: fixed` alone is unreliable inside Safari iOS.
  useEffect(() => {
    if (nativeFullscreen) return;
    document.body.classList.toggle('chartFullscreenActive', isFullscreen);
    return () => document.body.classList.remove('chartFullscreenActive');
  }, [isFullscreen, nativeFullscreen]);

  useEffect(() => {
    apiFetch<{ emas: Ema[] }>('/chart-indicators')
      .then(data => setEmas(data.emas ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch<{ display: { trendlineColor?: string; trendlineStyle?: string; trendlineWidth?: number; rectLabels?: boolean } }>('/settings')
      .then(data => {
        const color = data.display?.trendlineColor;
        const style = data.display?.trendlineStyle;
        const width = data.display?.trendlineWidth;
        const rectLabels = data.display?.rectLabels;
        if (color || style || width || rectLabels !== undefined) {
          setTrendlineAppearance(prev => ({
            color: color ?? prev.color,
            style: (style as TrendlineAppearance['style']) ?? prev.style,
            width: width ?? prev.width,
            rectLabels: rectLabels ?? prev.rectLabels,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const saveEmas = useCallback(async () => {
    try {
      await apiSend('/chart-indicators', 'PUT', { emas: emasRef.current });
    } catch (err) {
      addToast(errorMessage(err, 'Network error saving indicators'), 'error');
    }
  }, []);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const { pnlMode } = useDisplaySettings();

  useEffect(() => {
    apiFetch<{ broker: string; balance: number }[]>('/balances')
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        setBalances(Object.fromEntries(data.map(b => [b.broker, b.balance])));
        // pick the first visible broker if none is selected or the stored one is gone
        const pick = list.find(b => isBrokerVisible(visibilityRef.current, b)) ?? list[0];
        if (pick && !list.includes(broker)) setBroker(pick);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broker changed to none: clear the symbol list during render.
  const [prevBroker, setPrevBroker] = useState(broker);
  if (broker !== prevBroker) {
    setPrevBroker(broker);
    if (!broker) { setSymbols([]); setSymbol(''); }
  }

  useEffect(() => {
    if (!broker) return;
    const ac = new AbortController();
    apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(broker)}`, { signal: ac.signal })
      .then(list => {
        setSymbols(list);
        const visible = list.filter(s => isSymbolVisible(visibilityRef.current, broker, s));
        setSymbol(prev => list.includes(prev) ? prev : visible.includes('EURUSD') ? 'EURUSD' : visible[0] ?? list[0] ?? '');
      })
      .catch(() => {});
    return () => ac.abort();
  }, [broker]);

  // Ctrl + Arrows cycle the chart context in default list order:
  // Up/Down → symbol, Left/Right → broker.
  const symbolsRef = useRef<string[]>([]);
  const symbolRef = useRef('');
  const brokersRef = useRef<string[]>([]);
  const brokerRef = useRef('');
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { brokersRef.current = brokers; }, [brokers]);
  useEffect(() => { brokerRef.current = broker; }, [broker]);

  useEffect(() => {
    const cycle = (list: string[], current: string, step: number): string | null => {
      if (list.length === 0) return null;
      const idx = list.indexOf(current);
      const next = idx === -1 ? 0 : (idx + step + list.length) % list.length;
      return list[next];
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const next = cycle(symbolsRef.current, symbolRef.current, e.key === 'ArrowUp' ? -1 : 1);
        if (next === null) return;
        e.preventDefault();
        setSymbol(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const next = cycle(brokersRef.current, brokerRef.current, e.key === 'ArrowLeft' ? -1 : 1);
        if (next === null) return;
        e.preventDefault();
        setBroker(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useWs(useCallback((msg: unknown) => {
    const m = msg as {
      type: string;
      broker: string;
      brokerOffset?: number;
      currency?: string;
      userId?: number;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      positions?: Position[];
      symbol?: string;
      timeframe?: string;
      time?: number;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    };

    // A price alert fired (any broker/symbol, for this user): flash + beep.
    if (m.type === 'alert') {
      if (user && m.userId === user.id) {
        setAlertFlash(true);
        playAlertBeep();
        refreshAlerts();
      }
      return;
    }

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

    if (m.type === 'positions') {
      if (positionsMode === 'none') return;
      acceptPositions((m.positions ?? []).map(p => ({
        ...p,
        broker: p.broker ?? m.broker,
        brokerOffset: p.brokerOffset ?? m.brokerOffset,
        currency: p.currency ?? m.currency,
      })));
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
    chartRef.current?.updateLive(candle);
    if (alertsOpen) setPanelPrice(candle.close);
  }, [broker, symbol, timeframe, user, refreshAlerts, alertsOpen, positionsMode, acceptPositions]));

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

  const positionsKey = `${positionsMode}|${broker}`;
  const [prevPositionsKey, setPrevPositionsKey] = useState(positionsKey);
  if (positionsKey !== prevPositionsKey) {
    setPrevPositionsKey(positionsKey);
    if (positionsMode === 'none' || !broker) setPositions([]);
  }

  useEffect(() => {
    if (positionsMode === 'none' || !broker) { positionsSigRef.current = ''; return; }
    const ac = new AbortController();
    apiFetch<{ broker: string; brokerOffset?: number; currency?: string; positions: Position[] }[]>('/positions/live', { signal: ac.signal })
      .then(brokers => {
        const entry = brokers.find(b => b.broker === broker);
        acceptPositions((entry?.positions ?? []).map(p => ({
          ...p,
          broker: p.broker ?? broker,
          brokerOffset: p.brokerOffset ?? entry?.brokerOffset,
          currency: p.currency ?? entry?.currency,
        })));
      })
      .catch(() => {});
    return () => ac.abort();
  }, [positionsMode, broker, acceptPositions]);

  useEffect(() => {
    if (!broker || !symbol) return;
    hasMoreRef.current = true;
    // Selection changed: drop the previous live candle before the new history loads.
    liveCandleRef.current = null;
    chartRef.current?.updateLive(null);
    const ac = new AbortController();
    apiFetch<RawCandle[]>(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=2000`, { signal: ac.signal })
      .then(data => {
        const parsed = data.map(c => ({
          time: Math.floor(new Date(c.openTime).getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        parsed.sort((a, b) => a.time - b.time);
        setCandles(parsed);
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const parsed = data.map(c => ({
          time: Math.floor(new Date(c.openTime).getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        parsed.sort((a, b) => a.time - b.time);
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

  // Stable handlers so the memoised panels and toolbar skip renders (spec 019).
  const openIndicators = useCallback(() => setIndicatorsOpen(true), []);
  const closeIndicators = useCallback(() => setIndicatorsOpen(false), []);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const closeAlerts = useCallback(() => setAlertsOpen(false), []);
  const toggleDrawMode = useCallback((mode: DrawMode) => setDrawMode(prev => (prev === mode ? null : mode)), []);
  const clearDrawMode = useCallback(() => setDrawMode(null), []);
  const cyclePositions = useCallback(() => setPositionsMode(prev => POSITIONS_MODE_CYCLE[prev]), []);
  const openNewTrade = useCallback(() => setNewTradeOpen(true), []);
  const closeNewTrade = useCallback(() => setNewTradeOpen(false), []);
  const clearEdit = useCallback(() => setEditPosition(null), []);
  const clearClose = useCallback(() => setClosePosition(null), []);
  const editPositions = useMemo(() => (editPosition ? [editPosition] : []), [editPosition]);

  const toggleAlerts = useCallback(() => {
    setAlertsOpen(prev => {
      if (!prev) setPanelPrice(liveCandleRef.current?.close ?? null);
      return !prev;
    });
    setAlertFlash(false);
  }, []);

  const handleEditPosition = useCallback((ticket: number) => {
    const pos = positions.find(p => p.ticket === ticket);
    if (pos) setEditPosition(pos);
  }, [positions]);

  const handleClosePosition = useCallback((ticket: number) => {
    const pos = positions.find(p => p.ticket === ticket);
    if (pos) setClosePosition(pos);
  }, [positions]);

  const handleModifyPosition = useCallback((ticket: number, sl: number, tp: number) => {
    const pos = positions.find(p => p.ticket === ticket);
    if (!pos) return;
    sendCommand(modifyCommand(pos, sl, tp))
      .catch(err => addToast(errorMessage(err, 'Network error sending modify'), 'error'));
  }, [positions]);

  return (
    <div className={`${styles.page} ${isFullscreen ? styles.pageFullscreen : ''}`} ref={pageRef}>
      <ChartToolbar
        brokers={brokers}
        symbols={symbols}
        broker={broker}
        symbol={symbol}
        brokerHidden={brokerHidden}
        symbolHidden={symbolHidden}
        timeframe={timeframe}
        onBrokerChange={setBroker}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
        onIndicators={openIndicators}
        onFilters={openFilters}
        drawMode={drawMode}
        onDrawMode={toggleDrawMode}
        onAlerts={toggleAlerts}
        alertsActive={alertsOpen}
        alertsFlashing={alertFlash}
        onPositions={cyclePositions}
        positionsMode={positionsMode}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
      <ChartFiltersPanel
        open={filtersOpen}
        onClose={closeFilters}
        brokers={brokers}
        symbols={symbols}
        broker={broker}
        symbol={symbol}
        brokerHidden={brokerHidden}
        symbolHidden={symbolHidden}
        onBrokerChange={setBroker}
        onSymbolChange={setSymbol}
      />
      <AlertsPanel
        open={alertsOpen}
        onClose={closeAlerts}
        broker={broker}
        symbol={symbol}
        brokers={brokers}
        symbols={symbols}
        currentPrice={panelPrice}
        alerts={alerts}
        onCreate={createAlert}
        onToggle={toggleAlert}
        onDelete={removeAlert}
        emaAlerts={emaAlerts}
        onCreateEma={createEmaAlert}
        onToggleEma={toggleEmaAlert}
        onDeleteEma={removeEmaAlert}
      />
      <IndicatorsPanel
        open={indicatorsOpen}
        onClose={closeIndicators}
        emas={emas}
        onEmasChange={setEmas}
        onSave={saveEmas}
      />
      <div className={styles.chartArea}>
        {broker && symbol
          ? <ChartErrorBoundary resetKey={`${broker}-${symbol}-${timeframe}`}>
              <LightweightChart ref={chartRef} candles={candles} broker={broker} symbol={symbol} timeframe={timeframe} onLoadMore={hasMore ? loadMoreCandles : undefined} emas={emas} drawMode={drawMode} onDrawDone={clearDrawMode} positions={chartPositions} onEditPosition={handleEditPosition} onClosePosition={handleClosePosition} onModifyPosition={handleModifyPosition} initialDrawings={drawings ?? undefined} onDrawingsChange={handleDrawingsChange} trendlineAppearance={trendlineAppearance} accountBalance={balances[broker]} pnlMode={pnlMode} alerts={chartAlerts} showNewTrade={positionsMode !== 'none'} onNewTrade={openNewTrade} />
              {chartLoading && <div className={styles.chartLoadingOverlay} />}
            </ChartErrorBoundary>
          : <div className={styles.empty}>Select a broker and symbol</div>
        }
      </div>
      <NewTradePanel open={newTradeOpen} onClose={closeNewTrade} initialBroker={broker} initialSymbol={symbol} initialTimeframe={timeframe} />

      <BulkEditPanel
        open={!!editPosition}
        positions={editPositions}
        onClose={clearEdit}
      />

      <ClosePositionPanel
        open={!!closePosition}
        position={closePosition}
        onClose={clearClose}
      />
    </div>
  );
}
