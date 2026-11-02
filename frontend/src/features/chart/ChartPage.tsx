import { useState, useEffect, useCallback, useRef, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, apiSend, errorMessage } from '../../lib/api';
import { modifyCommand, sendCommand } from '../../lib/commands';
import { addToast } from '../../lib/toast';
import { useWs } from '../../lib/useWs';
import { useAuth } from '../auth/useAuth';
import { playAlertBeep } from '../../lib/beep';
import { ChartFiltersPanel } from './ChartFiltersPanel';
import { AlertsPanel } from './AlertsPanel';
import { useAlerts, type PriceAlert } from '../../lib/useAlerts';
import { useEmaAlerts } from '../../lib/useEmaAlerts';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { isBrokerVisible, isSymbolVisible, useVisibility } from '../../lib/visibility';
import type { TrendlineAppearance } from './DrawingTools';
import { IndicatorsPanel } from './IndicatorsPanel';
import { ChartSlot, type ChartSide } from './ChartSlot';
import { BulkEditPanel } from '../journal/BulkEditPanel';
import { ClosePositionPanel } from '../journal/ClosePositionPanel';
import { NewTradePanel } from '../journal/NewTradePanel';
import type { Ema } from './chart.types';
import type { Position } from '../journal/utils/position';
import styles from './ChartPage.module.css';

// One string per positions list: setPositions only when something visible changed (spec 019).
const positionsSignature = (list: Position[]): string =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}`).join(';');

// Split view (spec 036): the right chart opens one timeframe above the left one.
const NEXT_TIMEFRAME_UP: Record<string, string> = { M5: 'M15', M15: 'H1', H1: 'H4', H4: 'D1', D1: 'H1' };
const nextTimeframeUp = (tf: string): string => NEXT_TIMEFRAME_UP[tf] ?? 'H4';

interface SplitState {
  on: boolean;
  rightTimeframe: string;
  ratio: number;
  // Left timeframe at the moment the split was closed: reopening restores the same pair.
  leftTimeframe?: string;
}

const DEFAULT_SPLIT: SplitState = { on: false, rightTimeframe: 'H4', ratio: 0.5 };
const SPLIT_RATIO_MIN = 0.25;
const SPLIT_RATIO_MAX = 0.75;
const DIVIDER_WIDTH = 6;

// Narrowest width a slot can take without clipping its toolbar: the toolbar's two
// groups never shrink, so their widths plus gap and padding are its min-content.
const toolbarMinWidth = (area: HTMLElement): number => {
  const toolbar = area.querySelector<HTMLElement>('[data-chart-toolbar]');
  if (!toolbar) return 0;
  const style = getComputedStyle(toolbar);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const gap = parseFloat(style.columnGap) || 0;
  const groups = Array.from(toolbar.children) as HTMLElement[];
  return groups.reduce((sum, g) => sum + g.offsetWidth, 0) + gap * Math.max(0, groups.length - 1) + padding;
};

// Ratio bounds for the current area width: 25–75 %, tightened so neither toolbar clips.
const clampSplitRatio = (area: HTMLElement, ratio: number): number => {
  const width = area.getBoundingClientRect().width - DIVIDER_WIDTH;
  if (width <= 0) return ratio;
  const minFraction = toolbarMinWidth(area) / width;
  const min = Math.max(SPLIT_RATIO_MIN, minFraction);
  const max = Math.min(SPLIT_RATIO_MAX, 1 - minFraction);
  if (min > max) return 0.5;
  return Math.min(max, Math.max(min, ratio));
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

  // Last bid of the selected symbol: seeds the alerts panel price when it opens.
  const lastBidRef = useRef<number | null>(null);
  // Price shown by the alerts panel; fed only while the panel is open.
  const [panelPrice, setPanelPrice] = useState<number | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [newTradeOpen, setNewTradeOpen] = useState(false);
  const [alertFlash, setAlertFlash] = useState(false);
  const { user } = useAuth();
  const { alerts, refresh: refreshAlerts, create: createAlert, toggle: toggleAlert, updatePrice: updateAlertPrice, remove: removeAlert } = useAlerts();
  const { alerts: emaAlerts, create: createEmaAlert, toggle: toggleEmaAlert, remove: removeEmaAlert } = useEmaAlerts();
  const chartAlerts = useMemo(
    () => alerts.filter(a => a.broker === broker && a.symbol === symbol),
    [alerts, broker, symbol],
  );
  // Dragged on the chart (spec 028): the chart drops its optimistic price when this rejects.
  const moveAlert = useCallback(async (id: number, price: number) => {
    try {
      await updateAlertPrice(id, price);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to move alert'), 'error');
      throw err;
    }
  }, [updateAlertPrice]);
  const [alertEditRequest, setAlertEditRequest] = useState<{ id: number; nonce: number } | null>(null);
  const editAlertFromChart = useCallback((a: PriceAlert) => {
    setAlertEditRequest({ id: a.id, nonce: Date.now() });
    setAlertsOpen(true);
  }, []);
  const toggleAlertFromChart = useCallback((a: PriceAlert) => {
    toggleAlert(a).catch(err => addToast(errorMessage(err, 'Failed to update alert'), 'error'));
  }, [toggleAlert]);
  const deleteAlertFromChart = useCallback((a: PriceAlert) => {
    removeAlert(a.id).catch(err => addToast(errorMessage(err, 'Failed to delete alert'), 'error'));
  }, [removeAlert]);
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
  const [showSpread, setShowSpread] = useState(false);
  const [trendlineAppearance, setTrendlineAppearance] = useState<TrendlineAppearance>({ color: '#8c8c8c', style: 'dashed', width: 1 });
  const [emas, setEmas] = useState<Ema[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Which chart fills the page while fullscreen in split view; both show otherwise.
  const [fullscreenSide, setFullscreenSide] = useState<ChartSide>('left');

  // Split view (spec 036): desktop only; the right timeframe and the ratio survive a close.
  const [split, setSplit] = useLocalStorage<SplitState>('chart.split', DEFAULT_SPLIT);
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const showSplit = split.on && isDesktop;
  const timeframeRef = useRef(timeframe);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);
  // Closing from a chart keeps that chart: from the right one, its timeframe becomes the
  // single chart's timeframe (AC 5). Reopening restores the pair that was closed; the very
  // first split opens the next timeframe up on the right.
  const toggleSplit = useCallback((side: ChartSide) => {
    setSplit(prev => {
      if (!prev.on) {
        if (prev.leftTimeframe) {
          setTimeframe(prev.leftTimeframe);
          return { ...prev, on: true };
        }
        return { ...prev, on: true, rightTimeframe: nextTimeframeUp(timeframeRef.current) };
      }
      const leftTimeframe = timeframeRef.current;
      if (side === 'right') setTimeframe(prev.rightTimeframe);
      return { ...prev, on: false, leftTimeframe };
    });
  }, [setSplit]);
  const toggleSplitLeft = useCallback(() => toggleSplit('left'), [toggleSplit]);
  const toggleSplitRight = useCallback(() => toggleSplit('right'), [toggleSplit]);
  const setRightTimeframe = useCallback((tf: string) => {
    setSplit(prev => ({ ...prev, rightTimeframe: tf }));
  }, [setSplit]);
  const pageRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Divider drag (AC 8): the ratio follows the pointer inside the chart area, 25–75 %,
  // and is persisted with the rest of the split state on release.
  const startDividerDrag = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const area = chartAreaRef.current;
    if (!area || e.button !== 0) return;
    e.preventDefault();
    const rect = area.getBoundingClientRect();
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const ratio = clampSplitRatio(area, (ev.clientX - rect.left) / rect.width);
      setSplit(prev => (prev.ratio === ratio ? prev : { ...prev, ratio }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setDragging(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setSplit]);

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('chartDividerDragging');
    return () => document.body.classList.remove('chartDividerDragging');
  }, [dragging]);

  // A persisted ratio may not fit a narrower window: re-clamp whenever the area resizes.
  const splitLayoutActive = showSplit && !isFullscreen;
  useEffect(() => {
    const area = chartAreaRef.current;
    if (!splitLayoutActive || !area) return;
    const observer = new ResizeObserver(() => {
      setSplit(prev => {
        const ratio = clampSplitRatio(area, prev.ratio);
        return ratio === prev.ratio ? prev : { ...prev, ratio };
      });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [splitLayoutActive, setSplit]);
  const emasRef = useRef<Ema[]>([]);

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

  // The page element goes fullscreen (its side panels are fixed children, so they stay
  // visible); in split view only the chart that asked for it is rendered meanwhile.
  const toggleFullscreen = useCallback((side: ChartSide) => {
    const el = pageRef.current;
    if (!el) return;
    setFullscreenSide(side);
    const canNative = document.fullscreenEnabled && typeof el.requestFullscreen === 'function';
    if (canNative) {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen();
    } else {
      // CSS fullscreen fallback for iPhone
      setIsFullscreen(prev => !prev);
    }
  }, []);
  const toggleFullscreenLeft = useCallback(() => toggleFullscreen('left'), [toggleFullscreen]);
  const toggleFullscreenRight = useCallback(() => toggleFullscreen('right'), [toggleFullscreen]);

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
    apiFetch<{ display: { trendlineColor?: string; trendlineStyle?: string; trendlineWidth?: number; rectLabels?: boolean; showSpread?: boolean } }>('/settings')
      .then(data => {
        setShowSpread(data.display?.showSpread ?? false);
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

  // Page-level stream: fired alerts, live positions and the alerts panel price.
  // Each ChartSlot has its own subscriber for the candles of its timeframe (spec 036).
  useWs(useCallback((msg: unknown) => {
    const m = msg as {
      type: string;
      broker: string;
      brokerOffset?: number;
      currency?: string;
      userId?: number;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      positions?: Position[];
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

    if (m.type === 'positions') {
      acceptPositions((m.positions ?? []).map(p => ({
        ...p,
        broker: p.broker ?? m.broker,
        brokerOffset: p.brokerOffset ?? m.brokerOffset,
        currency: p.currency ?? m.currency,
      })));
      return;
    }

    if (m.type !== 'ticks' || !m.ticks) return;
    const last = m.ticks.findLast((t) => t.symbol === symbol);
    if (!last) return;
    lastBidRef.current = last.bid;
    if (alertsOpen) setPanelPrice(last.bid);
  }, [broker, symbol, user, refreshAlerts, alertsOpen, acceptPositions]));

  // Selection changed: drop the previous symbol's bid.
  useEffect(() => { lastBidRef.current = null; }, [broker, symbol]);

  const [prevPositionsBroker, setPrevPositionsBroker] = useState(broker);
  if (broker !== prevPositionsBroker) {
    setPrevPositionsBroker(broker);
    setPositions([]);
  }

  useEffect(() => {
    if (!broker) { positionsSigRef.current = ''; return; }
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
  }, [broker, acceptPositions]);

  // Stable handlers so the memoised panels and toolbar skip renders (spec 019).
  const openIndicators = useCallback(() => setIndicatorsOpen(true), []);
  const closeIndicators = useCallback(() => setIndicatorsOpen(false), []);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const closeAlerts = useCallback(() => setAlertsOpen(false), []);
  const openNewTrade = useCallback(() => setNewTradeOpen(true), []);
  const closeNewTrade = useCallback(() => setNewTradeOpen(false), []);
  const clearEdit = useCallback(() => setEditPosition(null), []);
  const clearClose = useCallback(() => setClosePosition(null), []);
  const editPositions = useMemo(() => (editPosition ? [editPosition] : []), [editPosition]);

  const toggleAlerts = useCallback(() => {
    setAlertsOpen(prev => {
      if (!prev) setPanelPrice(lastBidRef.current);
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

  const sharedSlotProps = {
    brokers,
    symbols,
    broker,
    symbol,
    brokerHidden,
    symbolHidden,
    onBrokerChange: setBroker,
    onSymbolChange: setSymbol,
    positions,
    balance: balances[broker],
    emas,
    trendlineAppearance,
    showSpread,
    pnlMode,
    alerts: chartAlerts,
    onMoveAlert: moveAlert,
    onEditAlertPrice: editAlertFromChart,
    onToggleAlert: toggleAlertFromChart,
    onDeleteAlert: deleteAlertFromChart,
    onIndicators: openIndicators,
    onFilters: openFilters,
    onAlerts: toggleAlerts,
    alertsActive: alertsOpen,
    alertsFlashing: alertFlash,
    onNewTrade: openNewTrade,
    onEditPosition: handleEditPosition,
    onClosePosition: handleClosePosition,
    onModifyPosition: handleModifyPosition,
    isFullscreen,
    splitAvailable: isDesktop,
    splitActive: showSplit,
  };
  const showLeft = !showSplit || !isFullscreen || fullscreenSide === 'left';
  const showRight = showSplit && (!isFullscreen || fullscreenSide === 'right');
  const splitLayout = showLeft && showRight;

  return (
    <div className={`${styles.page} ${isFullscreen ? styles.pageFullscreen : ''}`} ref={pageRef}>
      <div
        ref={chartAreaRef}
        className={`${styles.chartArea} ${splitLayout ? styles.split : ''}`}
        style={splitLayout ? { gridTemplateColumns: `minmax(0, ${split.ratio}fr) ${DIVIDER_WIDTH}px minmax(0, ${1 - split.ratio}fr)` } : undefined}
      >
        {showLeft && (
          <ChartSlot
            {...sharedSlotProps}
            side="left"
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            onFullscreen={toggleFullscreenLeft}
            onSplit={toggleSplitLeft}
          />
        )}
        {splitLayout && (
          <div
            className={`${styles.divider} ${dragging ? styles.dividerActive : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(split.ratio * 100)}
            aria-valuemin={SPLIT_RATIO_MIN * 100}
            aria-valuemax={SPLIT_RATIO_MAX * 100}
            title="Drag to resize"
            onMouseDown={startDividerDrag}
          />
        )}
        {showRight && (
          <ChartSlot
            {...sharedSlotProps}
            side="right"
            timeframe={split.rightTimeframe}
            onTimeframeChange={setRightTimeframe}
            onFullscreen={toggleFullscreenRight}
            onSplit={toggleSplitRight}
          />
        )}
      </div>
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
        onUpdatePrice={updateAlertPrice}
        onDelete={removeAlert}
        emaAlerts={emaAlerts}
        onCreateEma={createEmaAlert}
        onToggleEma={toggleEmaAlert}
        onDeleteEma={removeEmaAlert}
        editRequest={alertEditRequest}
      />
      <IndicatorsPanel
        open={indicatorsOpen}
        onClose={closeIndicators}
        emas={emas}
        onEmasChange={setEmas}
        onSave={saveEmas}
      />
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
