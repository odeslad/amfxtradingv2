import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createChart, CandlestickSeries, LineSeries, LineStyle, TickMarkType, CrosshairMode,
  createSeriesMarkers,
  type IChartApi, type ISeriesApi, type CandlestickData, type Time, type IPriceLine,
  type SeriesMarker, type ISeriesMarkersPluginApi,
} from 'lightweight-charts';
import type { Ema } from './chart.types';
import type { Position } from '../journal/utils/position';
import { DrawingManager, type PersistedDrawing, type TrendlineAppearance, type DrawingKind, type MarkerDirection, type SymbolVariant } from './DrawingTools';

import { formatEntryPnl, formatLevelPnl } from './positionRisk';
import { type PnlMode, isPending, isBuySide, TYPE_LABEL } from '../journal/utils/position';

export type DrawMode = 'line' | 'rect' | 'markerBuy' | 'markerSell' | 'ruler' | 'symbolCross' | 'symbolCheck' | 'text';

function drawModeToKind(mode: DrawMode): { kind: DrawingKind; direction: MarkerDirection; variant: SymbolVariant } {
  if (mode === 'rect') return { kind: 'rect', direction: 'buy', variant: 'cross' };
  if (mode === 'text') return { kind: 'text', direction: 'buy', variant: 'cross' };
  if (mode === 'markerBuy') return { kind: 'marker', direction: 'buy', variant: 'cross' };
  if (mode === 'markerSell') return { kind: 'marker', direction: 'sell', variant: 'cross' };
  if (mode === 'symbolCross') return { kind: 'symbol', direction: 'buy', variant: 'cross' };
  if (mode === 'symbolCheck') return { kind: 'symbol', direction: 'buy', variant: 'check' };
  return { kind: 'line', direction: 'buy', variant: 'cross' };
}
import styles from './LightweightChart.module.css';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const ROLLOVER_TIMEFRAMES = new Set(['M5', 'M15', 'H1', 'H4', 'D1']);
// timeframes that only show the weekly (sunday) rollover line, not the daily ones
const WEEKLY_ONLY_TIMEFRAMES = new Set(['H4']);
// timeframes that show month-start lines
const MONTH_START_TIMEFRAMES = new Set(['H4', 'D1']);

// Candle times come 1h ahead of broker time; shift only the displayed labels.
const DISPLAY_TIME_SHIFT_SEC = 3600;

const LINE_STYLE: Record<string, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
};

interface LightweightChartProps {
  candles: Candle[];
  broker: string;
  symbol: string;
  timeframe: string;
  liveCandle?: Candle | null;
  onLoadMore?: () => void;
  emas: Ema[];
}

function fmtLots(lots: number): string {
  return lots.toFixed(2);
}

function fmtPrice(price: number, precision: number): string {
  return price.toFixed(precision);
}

// openTime comes in broker time as "YYYY.MM.DD HH:MM[:SS]". Treat the components
// as UTC and subtract the broker offset to get the real UTC instant — same basis
// as the candle `time` values. Mirrors fmtLocalTime in journal/utils/position.
function openTimeToUtcSec(raw: string, brokerOffsetSec: number): number {
  const m = raw.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, s || 0) - brokerOffsetSec * 1000;
  return Math.floor(utcMs / 1000);
}

interface PositionLabel {
  id: string;
  ticket: number;
  text: string;
  color: string;
  price: number;
  top: number;
  visible: boolean;
}

interface DraggableLevel {
  id: string;
  kind: 'sl' | 'tp';
  ticket: number;
  broker: string;
  symbol: string;
  lots: number;
  price: number;
  sl: number;
  tp: number;
}

interface DragState {
  level: DraggableLevel;
  currentPrice: number;
}

// Fixed price precision per symbol, independent of what each broker sends:
// JPY pairs use 3 decimals, everything else 5.
function getPricePrecision(symbol: string): number {
  return symbol.toUpperCase().includes('JPY') ? 3 : 5;
}

function calcEma(candles: Candle[], period: number): { time: Time; value: number }[] {
  // Only feed candles with a finite close; a single NaN/null close otherwise
  // poisons the whole EMA and lightweight-charts throws "Value is null" on hitTest.
  const valid = candles.filter(c => Number.isFinite(c.close) && Number.isFinite(c.time));
  if (valid.length < period) return [];
  const k = 2 / (period + 1);
  let ema = valid.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result: { time: Time; value: number }[] = [{ time: valid[period - 1].time as Time, value: ema }];
  for (let i = period; i < valid.length; i++) {
    ema = valid[i].close * k + ema * (1 - k);
    result.push({ time: valid[i].time as Time, value: ema });
  }
  return result;
}

interface RolloverLine {
  time: number;
  weekly: boolean;
}

function getRolloverTimes(fromSec: number, toSec: number): RolloverLine[] {
  const times: RolloverLine[] = [];
  const cursor = new Date((fromSec - 86400) * 1000);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() / 1000 <= toSec + 4 * 86400) {
    const dayOfWeek = cursor.getUTCDay();
    const midnightSec = cursor.getTime() / 1000;

    // rollover sits at 23:00 broker time. Candle times run DISPLAY_TIME_SHIFT_SEC
    // ahead of broker time, so add that shift to the line position.
    if (dayOfWeek === 6) {
      // saturday: market closed, no line
    } else {
      const rolloverSec = midnightSec + 23 * 3600 + DISPLAY_TIME_SHIFT_SEC;
      if (rolloverSec >= fromSec && rolloverSec <= toSec + 86400) {
        // sunday 23:00 = weekly market reopen, highlighted brighter
        times.push({ time: rolloverSec, weekly: dayOfWeek === 0 });
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return times;
}

// First operational candle of each month. Detected from real candle data so a
// month that opens on a sunday lands on its actual first bar. Times are compared
// in broker time (candle.time shifted back by DISPLAY_TIME_SHIFT_SEC).
function getMonthStartTimes(candles: Candle[]): Set<number> {
  // Group by calendar month (broker time) and take the earliest candle of each.
  // Order-independent so it survives unsorted arrays (loadMore prepends).
  const firstOfMonth = new Map<string, number>();
  for (const c of candles) {
    const brokerDate = new Date((c.time - DISPLAY_TIME_SHIFT_SEC) * 1000);
    const key = `${brokerDate.getUTCFullYear()}-${brokerDate.getUTCMonth()}`;
    const existing = firstOfMonth.get(key);
    if (existing === undefined || c.time < existing) firstOfMonth.set(key, c.time);
  }
  return new Set(firstOfMonth.values());
}

export interface BacktestOverlayLevels {
  ECC: number;
  EMA: number;
  EVL: number | null;
  MHL: number | null;
}

export interface BacktestOverlayTrade {
  direction: 'buy' | 'sell';
  entryTime: string | null;
  entryPrice: number;
  exitTime: string | null;
  exitPrice: number | null;
  sl: number;
  tp: number;
  status: string;
  reason: string | null;
  slHistory?: { time: string; sl: number }[];
}

export interface BacktestOverlaySetup {
  id: number;
  direction: 'buy' | 'sell';
  activationTime: string;
  closeTime: string | null;
  levels: BacktestOverlayLevels;
  trades: BacktestOverlayTrade[];
  weakCandles?: string[];
  strongCandles?: string[];
}

export interface BacktestOverlayLayers {
  setups: boolean;
  levels: boolean;
  entries: boolean;
  exits: boolean;
  sltp: boolean;
  ws: boolean;
}

export interface BacktestOverlay {
  setups: BacktestOverlaySetup[];
  layers: BacktestOverlayLayers;
}

interface LightweightChartExtendedProps extends LightweightChartProps {
  backtestOverlay?: BacktestOverlay;
  focusRange?: { from: number; to: number; nonce: number } | null;
  // Sliding-window metadata for the backtest chart. 'older'/'newer' updates
  // preserve the view (re-anchor on the first visible candle); the rest reset.
  candlesKind?: 'initial' | 'older' | 'newer' | 'around';
  // EMA series precomputed by the backend over the full history (fast/slow per
  // candle time). Replaces the chart's own EMA calc so lines match the setups.
  emaData?: { time: number; fast: number | null; slow: number | null }[];
  onLoadNewer?: () => void;
  hasNewer?: boolean;
  drawMode?: DrawMode | null;
  onDrawDone?: () => void;
  positions?: Position[];
  onEditPosition?: (ticket: number) => void;
  onClosePosition?: (ticket: number) => void;
  onModifyPosition?: (ticket: number, sl: number, tp: number) => void;
  initialDrawings?: PersistedDrawing[] | null;
  onDrawingsChange?: (items: PersistedDrawing[]) => void;
  trendlineAppearance?: TrendlineAppearance;
  accountBalance?: number;
  pnlMode?: PnlMode;
  alerts?: { id: number; price: number; enabled: boolean }[];
  showNewTrade?: boolean;
  onNewTrade?: () => void;
}

export function LightweightChart({ candles, broker, symbol, timeframe, liveCandle, onLoadMore, emas, backtestOverlay, focusRange, candlesKind, emaData, onLoadNewer, hasNewer, drawMode, onDrawDone, positions, onEditPosition, onModifyPosition, initialDrawings, onDrawingsChange, trendlineAppearance, accountBalance, pnlMode = 'net', alerts, showNewTrade, onNewTrade, onClosePosition }: LightweightChartExtendedProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  // Keep a synchronously-fresh view of the current candles so focus logic never
  // reads a stale/empty ref (the candles effect updates its own ref too late for
  // the focus effect, which caused double-click to intermittently miss).
  const focusCandlesRef = useRef(candles);
  focusCandlesRef.current = candles;
  const alertsRef = useRef(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  const backtestOverlayRef = useRef(backtestOverlay);
  useEffect(() => {
    backtestOverlayRef.current = backtestOverlay;
    drawRolloversRef.current();
  }, [backtestOverlay]);

  // Focus the chart on a given time range (scroll + zoom). Driven by a nonce so
  // re-focusing the same range works. The candles effect consumes pendingFocus
  // so the initial auto-scroll-to-end doesn't override it.
  const pendingFocusRef = useRef<{ from: number; to: number } | null>(null);
  const applyFocus = useCallback(() => {
    const f = pendingFocusRef.current;
    const chart = chartRef.current;
    if (!f || !chart) return;
    // Snap the requested [from,to] to real candle times that are actually on the
    // axis (weekends are filtered out of the series). Read the latest candles ref
    // (updated by the candles effect) so a retry sees freshly-loaded data. If the
    // range isn't loaded yet, keep it pending so a later change retries.
    const data = focusCandlesRef.current.filter(c => {
      const d = new Date(c.time * 1000).getUTCDay();
      return d !== 0 && d !== 6;
    });
    if (data.length === 0) return;
    // first candle at/after `from`
    const fromCandle = data.find(c => c.time >= f.from);
    // last candle at/before `to`
    let toCandle: typeof data[number] | undefined;
    for (let i = data.length - 1; i >= 0; i--) { if (data[i].time <= f.to) { toCandle = data[i]; break; } }
    if (!fromCandle || !toCandle || fromCandle.time > toCandle.time) return; // not loaded yet
    try {
      chart.timeScale().setVisibleRange({ from: fromCandle.time as Time, to: toCandle.time as Time });
      pendingFocusRef.current = null;
    } catch {
      // keep pending
    }
  }, []);
  // Set the pending focus when a request arrives.
  useEffect(() => {
    if (!focusRange) return;
    pendingFocusRef.current = { from: focusRange.from, to: focusRange.to };
    applyFocus();
  }, [focusRange, applyFocus]);

  // Retry the pending focus whenever candles change: after a jump the target
  // range arrives one render later than the focus request. Reading the fresh
  // candles ref, this applies as soon as the right data is present.
  useEffect(() => {
    if (pendingFocusRef.current) applyFocus();
  }, [candles, applyFocus]);

  const drawRolloversRef = useRef<() => void>(() => { });

  // Double activation that works on both desktop (dblclick) and touch (two quick
  // taps), since onDoubleClick doesn't fire reliably on touch devices.
  const lastTapRef = useRef<Record<string, number>>({});
  const doubleTapProps = (key: string, onActivate: () => void) => ({
    onDoubleClick: onActivate,
    onTouchEnd: (e: React.TouchEvent) => {
      const now = e.timeStamp;
      const prev = lastTapRef.current[key] ?? 0;
      if (now - prev < 300) {
        e.preventDefault();
        lastTapRef.current[key] = 0;
        onActivate();
      } else {
        lastTapRef.current[key] = now;
      }
    },
  });
  const trendlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const candlesRef = useRef<Candle[]>([]);
  const emasRef = useRef<Ema[]>(emas);
  const emaDataRef = useRef<NonNullable<typeof emaData>>(emaData ?? []);
  emaDataRef.current = emaData ?? [];
  const timeframeRef = useRef<string>(timeframe);
  const liveCandleTimeRef = useRef<number | null>(null);
  const onLoadMoreRef = useRef<(() => void) | undefined>(undefined);
  const onLoadNewerRef = useRef<(() => void) | undefined>(undefined);
  const hasNewerRef = useRef(false);
  useEffect(() => { onLoadNewerRef.current = onLoadNewer; }, [onLoadNewer]);
  useEffect(() => { hasNewerRef.current = hasNewer ?? false; }, [hasNewer]);
  const isLoadingMoreRef = useRef(false);
  const trendlineManagerRef = useRef<DrawingManager | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const positionLevelsRef = useRef<Omit<PositionLabel, 'top' | 'visible'>[]>([]);
  const draggableRef = useRef<DraggableLevel[]>([]);
  const dragStateRef = useRef<DragState | null>(null);
  const selectedLevelIdRef = useRef<string | null>(null);
  // optimistic SL/TP overrides (id -> price) kept until server feedback matches
  const pendingPriceRef = useRef<Map<string, number>>(new Map());
  const precisionRef = useRef(5);
  const onModifyRef = useRef(onModifyPosition);
  useEffect(() => { onModifyRef.current = onModifyPosition; }, [onModifyPosition]);
  const onDrawingsChangeRef = useRef(onDrawingsChange);
  useEffect(() => { onDrawingsChangeRef.current = onDrawingsChange; }, [onDrawingsChange]);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasDrawings, setHasDrawings] = useState(false);
  const [positionLabels, setPositionLabels] = useState<PositionLabel[]>([]);
  const [hoverOhlc, setHoverOhlc] = useState<{ open: number; high: number; low: number; close: number } | null>(null);

  interface EntryPoint { x: number; y: number; id: string; entryPrice: number; sl: number; tp: number; entryTime: string | null; }
  const entryPointsRef = useRef<EntryPoint[]>([]);
  const [entryTip, setEntryTip] = useState<{ left: number; top: number; p: EntryPoint } | null>(null);
  const onDrawDoneRef = useRef(onDrawDone);
  useEffect(() => { onDrawDoneRef.current = onDrawDone; }, [onDrawDone]);

  useEffect(() => {
    if (drawMode === 'ruler') {
      trendlineManagerRef.current?.startRuler(() => onDrawDoneRef.current?.());
    } else if (drawMode) {
      const { kind, direction, variant } = drawModeToKind(drawMode);
      trendlineManagerRef.current?.startDrawing(kind, () => onDrawDoneRef.current?.(), direction, variant);
    } else {
      trendlineManagerRef.current?.stopDrawing();
    }
  }, [drawMode]);

  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  const trendlineAppearanceRef = useRef(trendlineAppearance);
  useEffect(() => {
    trendlineAppearanceRef.current = trendlineAppearance;
    if (trendlineAppearance) trendlineManagerRef.current?.setAppearance(trendlineAppearance);
  }, [trendlineAppearance]);

  const loadedDrawingsRef = useRef<PersistedDrawing[] | null | undefined>(null);
  const initialDrawingsRef = useRef(initialDrawings);

  // Reset loaded guard when the chart context changes so a new fetch triggers a reload.
  // Also clear EMA series data immediately: the new symbol/TF candles arrive a tick
  // later, and a hitTest in that window over a stale EMA throws "Value is null".
  useEffect(() => {
    loadedDrawingsRef.current = null;
    for (const series of emaSeriesRef.current.values()) {
      try { series.setData([]); } catch { /* series may be detached */ }
    }
  }, [broker, symbol, timeframe]);

  // null = fetch in flight (ignore). array = confirmed (load, even if empty to clear canvas).
  // Only load if candle index is ready; otherwise the candles effect picks it up.
  useEffect(() => {
    initialDrawingsRef.current = initialDrawings;
    if (initialDrawings == null) return;
    if (loadedDrawingsRef.current === initialDrawings) return;
    const manager = trendlineManagerRef.current;
    if (!manager || manager.candleIndexLength() === 0) return;
    loadedDrawingsRef.current = initialDrawings;
    manager.loadPersisted(initialDrawings);
  }, [initialDrawings]);

  const repositionLabels = useCallback(() => {
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!series || !container) { setPositionLabels([]); return; }
    const height = container.clientHeight;
    setPositionLabels(positionLevelsRef.current.map(l => {
      const y = series.priceToCoordinate(l.price);
      return {
        ...l,
        top: y ?? 0,
        visible: y !== null && y >= 0 && y <= height,
      };
    }));
  }, []);
  const repositionLabelsRef = useRef(repositionLabels);
  useEffect(() => { repositionLabelsRef.current = repositionLabels; }, [repositionLabels]);

  useEffect(() => {
    let raf = 0;
    let lastSig = '';
    let lastAlertSig = '';
    const tick = () => {
      const series = seriesRef.current;
      if (series && positionLevelsRef.current.length > 0) {
        const sig = positionLevelsRef.current
          .map(l => `${(series.priceToCoordinate(l.price) ?? -1) | 0}`)
          .join('|');
        if (sig !== lastSig) {
          lastSig = sig;
          repositionLabelsRef.current();
        }
      } else if (lastSig !== '') {
        lastSig = '';
      }

      // redraw the overlay (alert triangles) when their Y position shifts
      const list = alertsRef.current;
      if (series && list && list.length > 0) {
        const sig = list.map(a => `${a.id}:${a.enabled ? 1 : 0}:${(series.priceToCoordinate(a.price) ?? -1) | 0}`).join('|');
        if (sig !== lastAlertSig) {
          lastAlertSig = sig;
          drawRolloversRef.current();
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Left-pointing triangle markers pinned to the right edge of the pane (before
  // the price axis) with the alert price as a label. Orange when armed, grey off.
  const drawBacktestOverlay = useCallback((
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    bottom: number,
    data: Candle[],
  ) => {
    entryPointsRef.current = [];
    const overlay = backtestOverlayRef.current;
    const series = seriesRef.current;
    if (!overlay || !series || overlay.setups.length === 0 || data.length === 0) return;
    const { setups, layers } = overlay;

    const epoch = (iso: string | null): number | null =>
      iso ? Math.floor(new Date(iso).getTime() / 1000) : null;

    // data is sorted ascending by time; binary-search for speed (called many
    // times per repaint across all visible setups).
    // Greatest candle time <= target (candle CLOSE convention for setup/levels).
    const candleTimeAt = (target: number): number | null => {
      let lo = 0, hi = data.length - 1, res = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (data[mid].time <= target) { res = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return res === -1 ? null : data[res].time;
    };
    // First candle time > target (entry/exit are candle OPENs).
    const candleTimeForOpen = (target: number): number | null => {
      let lo = 0, hi = data.length - 1, res = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (data[mid].time > target) { res = mid; hi = mid - 1; } else lo = mid + 1;
      }
      return res === -1 ? null : data[res].time;
    };
    const xOf = (sec: number): number | null => {
      const ct = candleTimeAt(sec);
      if (ct === null) return null;
      const x = chart.timeScale().timeToCoordinate(ct as Time);
      return x === null ? null : Math.round(x) + 0.5;
    };
    const xOfOpen = (sec: number): number | null => {
      const ct = candleTimeForOpen(sec);
      if (ct === null) return null;
      const x = chart.timeScale().timeToCoordinate(ct as Time);
      return x === null ? null : Math.round(x) + 0.5;
    };
    const yOf = (price: number): number | null => {
      const y = series.priceToCoordinate(price);
      return y === null ? null : Math.round(y) + 0.5;
    };

    const LEVEL_COLORS: Record<string, string> = {
      ECC: '#7ee0a0', // light green
      EMA: '#f5e642', // bright yellow
      EVL: '#ff9d3a', // orange
      MHL: '#ff5a5a', // red
    };

    ctx.lineWidth = 1;

    // Only draw setups that overlap the visible time window (plus a margin), so
    // hundreds of setups don't all get processed every repaint.
    const visible = chart.timeScale().getVisibleRange();
    const vFrom = visible ? (visible.from as number) : -Infinity;
    const vTo = visible ? (visible.to as number) : Infinity;

    for (let i = 0; i < setups.length; i++) {
      const setup = setups[i];
      const actSec = epoch(setup.activationTime);
      if (actSec === null) continue;

      // Skip setups fully outside the visible window (activation → close).
      const endSec = epoch(setup.closeTime) ?? actSec;
      if (endSec < vFrom || actSec > vTo) continue;

      const dirColor = setup.direction === 'buy' ? '#4caf84' : '#e05c5c';
      // A setup ends at its opposite cross (closeTime); fall back to data end.
      const closeSec = epoch(setup.closeTime);

      // 1. Setup activation: dotted vertical line, green buy / red sell.
      if (layers.setups) {
        const x = xOf(actSec);
        if (x !== null) {
          ctx.setLineDash([1, 3]);
          ctx.strokeStyle = dirColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, bottom);
          ctx.stroke();
          ctx.setLineDash([]);

          // setup id at the bottom of the line, white text with a black outline
          const label = String(setup.id);
          ctx.font = '700 9px "DM Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000';
          ctx.strokeText(label, x, bottom - 2);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, x, bottom - 2);
          ctx.lineWidth = 1;
        }
      }

      // 1b. Weak/strong candle markers (debug): violet diamond on weak, lime on
      // strong. On buy, weak sits below the candle and strong above; on sell,
      // the opposite. Lets you check the trailing follows the right weak candles.
      if (layers.ws) {
        const candleAt = (sec: number): Candle | null => {
          let lo = 0, hi = data.length - 1, res = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (data[mid].time <= sec) { res = mid; lo = mid + 1; } else hi = mid - 1;
          }
          return res === -1 ? null : data[res];
        };
        const diamond = (x: number, y: number, color: string) => {
          const r = 4;
          ctx.beginPath();
          ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };
        const drawMarks = (times: string[] | undefined, color: string, below: boolean) => {
          if (!times) return;
          for (const t of times) {
            const sec = epoch(t);
            if (sec === null) continue;
            const c = candleAt(sec);
            const x = xOf(sec);
            if (!c || x === null) continue;
            const price = below ? c.low : c.high;
            const y = yOf(price);
            if (y === null) continue;
            diamond(x, y + (below ? 10 : -10), color);
          }
        };
        const weakBelow = setup.direction === 'buy';
        drawMarks(setup.weakCandles, '#a855f7', weakBelow);       // violet
        drawMarks(setup.strongCandles, '#a3e635', !weakBelow);    // lime
      }

      // 2. Level lines from this setup's activation to its close (opposite cross).
      if (layers.levels) {
        const x1 = xOf(actSec);
        const x2 = closeSec !== null ? xOf(closeSec) : chart.timeScale().timeToCoordinate(data[data.length - 1].time as Time);
        if (x1 !== null && x2 !== null) {
          ctx.font = '700 9px "DM Mono", monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'right';
          for (const key of ['ECC', 'EMA', 'EVL', 'MHL'] as const) {
            const price = setup.levels[key];
            if (price === null || price === undefined) continue;
            const y = yOf(price);
            if (y === null) continue;
            ctx.strokeStyle = LEVEL_COLORS[key];
            ctx.lineWidth = 1;
            ctx.setLineDash([1, 3]);
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2 as number, y);
            ctx.stroke();
            ctx.setLineDash([]);
            // label "NAME price" to the left of the line start, with black outline
            const label = `${key} ${price.toFixed(precisionRef.current)}`;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000';
            ctx.strokeText(label, x1 - 6, y);
            ctx.fillStyle = LEVEL_COLORS[key];
            ctx.fillText(label, x1 - 6, y);
            ctx.lineWidth = 1;
          }
        }
      }

      // 3 & 4. Per-trade: entry/exit short horizontal ticks + SL/TP dotted lines.
      for (let ti = 0; ti < setup.trades.length; ti++) {
        const trade = setup.trades[ti];
        const entSec = epoch(trade.entryTime);
        const exSec = epoch(trade.exitTime);

        if (layers.entries && entSec !== null) {
          const x = xOfOpen(entSec);
          const y = yOf(trade.entryPrice);
          if (x !== null && y !== null) {
            // Arrow whose TIP sits exactly on the entry price: up (green) for
            // buy, down (red) for sell. The base is offset away from the price.
            const up = trade.direction === 'buy';
            const w = 5;   // half width
            const h = 8;   // height
            const baseY = up ? y + h : y - h; // base behind the tip
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x, y);          // tip on the entry price
            ctx.lineTo(x - w, baseY);
            ctx.lineTo(x + w, baseY);
            ctx.closePath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#000';
            ctx.stroke();
            ctx.fillStyle = up ? '#4caf84' : '#e05c5c';
            ctx.fill();
            ctx.lineWidth = 1;

            entryPointsRef.current.push({
              x, y,
              id: `${setup.id}.${ti + 1}`,
              entryPrice: trade.entryPrice,
              sl: trade.sl,
              tp: trade.tp,
              entryTime: trade.entryTime,
            });
          }
        }

        if (layers.exits && exSec !== null && trade.exitPrice !== null) {
          const x = xOfOpen(exSec);
          const y = yOf(trade.exitPrice);
          if (x !== null && y !== null) {
            // X (red) when closed by SL, check (green) when by TP, else a tick.
            const sym = trade.reason === 'SL' ? '✕' : trade.reason === 'TP' ? '✓' : '·';
            const color = trade.reason === 'SL' ? '#e05c5c' : trade.reason === 'TP' ? '#4caf84' : 'rgba(232,232,232,0.8)';
            ctx.setLineDash([]);
            ctx.font = '700 13px "DM Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(sym, x, y);
            ctx.fillStyle = color;
            ctx.fillText(sym, x, y);
            ctx.lineWidth = 1;
          }
        }

        // SL/TP dotted from entry candle to exit candle (or data end if open).
        if (layers.sltp && entSec !== null) {
          const xa = xOfOpen(entSec);
          const xb = exSec !== null
            ? xOfOpen(exSec)
            : chart.timeScale().timeToCoordinate(data[data.length - 1].time as Time);

          // Dotted grey line connecting the entry point to the exit point.
          if (xa !== null && xb !== null && exSec !== null && trade.exitPrice !== null) {
            const ya = yOf(trade.entryPrice);
            const yb = yOf(trade.exitPrice);
            if (ya !== null && yb !== null) {
              ctx.setLineDash([1, 3]);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(180,180,180,0.8)';
              ctx.beginPath();
              ctx.moveTo(xa, ya);
              ctx.lineTo(xb as number, yb);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          if (xa !== null && xb !== null) {
            ctx.font = '700 9px "DM Mono", monospace';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'right';
            const drawSlTpLabel = (label: string, ly: number, color: string) => {
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#000';
              ctx.strokeText(label, xa - 6, ly);
              ctx.fillStyle = color;
              ctx.fillText(label, xa - 6, ly);
            };
            ctx.setLineDash([3, 3]);
            const slY = yOf(trade.sl);
            const steps = trade.slHistory ?? [];
            if (steps.length > 1) {
              // Trailing moved the SL: draw a step line so each move is visible
              // at the candle where it happened, independent of the price path.
              ctx.strokeStyle = '#e05c5c';
              ctx.lineWidth = 2;
              ctx.beginPath();
              let started = false;
              for (let s = 0; s < steps.length; s++) {
                const stepSec = epoch(steps[s].time);
                const y = yOf(steps[s].sl);
                if (stepSec === null || y === null) continue;
                const x = xOfOpen(stepSec) ?? xa;
                const xEnd = s + 1 < steps.length
                  ? (xOfOpen(epoch(steps[s + 1].time) ?? stepSec) ?? (xb as number))
                  : (xb as number);
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
                ctx.lineTo(xEnd, y); // horizontal run at this SL level
              }
              ctx.stroke();
              const lastY = yOf(steps[steps.length - 1].sl);
              if (lastY !== null) drawSlTpLabel(`SL ${steps[steps.length - 1].sl.toFixed(precisionRef.current)}`, lastY, '#e05c5c');
            } else if (slY !== null) {
              ctx.strokeStyle = '#e05c5c';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(xa, slY);
              ctx.lineTo(xb as number, slY);
              ctx.stroke();
              drawSlTpLabel(`SL ${trade.sl.toFixed(precisionRef.current)}`, slY, '#e05c5c');
            }
            if (trade.tp) {
              const tpY = yOf(trade.tp);
              if (tpY !== null) {
                ctx.strokeStyle = '#4caf84';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xa, tpY);
                ctx.lineTo(xb as number, tpY);
                ctx.stroke();
                drawSlTpLabel(`TP ${trade.tp.toFixed(precisionRef.current)}`, tpY, '#4caf84');
              }
            }
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
          }
        }
      }
    }
  }, []);

  const drawAlertMarkers = useCallback((
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
  ) => {
    const list = alertsRef.current;
    if (!list || list.length === 0) return;

    const priceAxisW = chart.priceScale('right').width();
    const right = ctx.canvas.width - priceAxisW;
    const bottom = ctx.canvas.height - chart.timeScale().height();

    ctx.font = '9px "DM Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';

    for (const alert of list) {
      const y = series.priceToCoordinate(alert.price);
      if (y === null || y < 0 || y > bottom) continue;

      const color = alert.enabled ? '#f5a623' : '#666666';
      const size = 4;
      const tipX = right - 5; // overlap the price-axis edge slightly

      // triangle pointing left
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tipX, y);
      ctx.lineTo(tipX + size, y - size);
      ctx.lineTo(tipX + size, y + size);
      ctx.closePath();
      ctx.fill();

      // price label to the left of the triangle, nudged down 1px for visual alignment
      ctx.fillText(String(alert.price), tipX - 4, y + 1);
    }
  }, []);

  const drawRollovers = useCallback(() => {
    const canvas = overlayRef.current;
    const chart = chartRef.current;
    const data = candlesRef.current;
    if (!canvas || !chart || data.length === 0) return;
    if (!ROLLOVER_TIMEFRAMES.has(timeframeRef.current)) {
      const ctx2 = canvas.getContext('2d');
      ctx2?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tf = timeframeRef.current;
    const weeklyOnly = WEEKLY_ONLY_TIMEFRAMES.has(tf);
    const showMonthly = MONTH_START_TIMEFRAMES.has(tf);
    const isDaily = tf === 'D1';

    const monthStarts = showMonthly ? getMonthStartTimes(data) : new Set<number>();

    // stop lines before the time axis so they don't overlap the date labels
    const bottom = canvas.height - chart.timeScale().height();

    // Snap a target time to a candle that is actually on the chart axis.
    // Weekend bars are filtered out of the series, so a month-start landing on a
    // sunday has no coordinate — snap forward to the next weekday bar instead.
    const isWeekend = (sec: number) => {
      const d = new Date(sec * 1000).getUTCDay();
      return d === 0 || d === 6;
    };
    const snapToCandle = (time: number): number | null => {
      let best: number | null = null;
      for (const c of data) {
        if (isWeekend(c.time)) continue;
        if (c.time === time) return time;
        if (c.time > time && (best === null || c.time < best)) best = c.time;
      }
      return best;
    };

    const drawLine = (time: number, color: string) => {
      const snapped = snapToCandle(time);
      if (snapped === null) return;
      const x = chart.timeScale().timeToCoordinate(snapped as Time);
      if (x === null) return;
      const px = Math.round(x) + 0.5;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, bottom);
      ctx.stroke();
    };

    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);

    // D1 only shows month-start lines; other TFs show daily/weekly rollovers too
    if (!isDaily) {
      const rolloverTimes = getRolloverTimes(data[0].time, data[data.length - 1].time);
      for (const { time, weekly } of rolloverTimes) {
        if (weeklyOnly && !weekly) continue;
        if (monthStarts.has(time)) continue; // drawn brighter below
        drawLine(time, weekly ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.30)');
      }
    }

    // month-start lines, brightest
    for (const time of monthStarts) {
      drawLine(time, 'rgba(255,255,255,0.85)');
    }
    ctx.setLineDash([]);

    if (seriesRef.current) drawBacktestOverlay(ctx, chart, bottom, data);
    if (seriesRef.current) drawAlertMarkers(ctx, chart, seriesRef.current);
  }, [drawAlertMarkers, drawBacktestOverlay]);

  useEffect(() => { drawRolloversRef.current = drawRollovers; }, [drawRollovers]);

  const syncEmaSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const currentEmas = emasRef.current;

    const existingIds = new Set(emaSeriesRef.current.keys());

    for (const ema of currentEmas) {
      if (!emaSeriesRef.current.has(ema.id)) {
        const series = chart.addSeries(LineSeries, {
          color: ema.color,
          lineWidth: ema.width,
          lineStyle: LINE_STYLE[ema.style],
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        emaSeriesRef.current.set(ema.id, series);
      } else {
        emaSeriesRef.current.get(ema.id)!.applyOptions({
          color: ema.color,
          lineWidth: ema.width,
          lineStyle: LINE_STYLE[ema.style],
        });
      }
      existingIds.delete(ema.id);
    }

    for (const id of existingIds) {
      chart.removeSeries(emaSeriesRef.current.get(id)!);
      emaSeriesRef.current.delete(id);
    }

    const backendEmas = emaDataRef.current;

    // Backtest chart: EMA values come from the backend (full-history accurate)
    // so lines and crosses match the setups exactly.
    if (backendEmas.length > 0) {
      for (const ema of currentEmas) {
        const series = emaSeriesRef.current.get(ema.id)!;
        const seenT = new Set<number>();
        const data = backendEmas
          .filter(p => {
            const val = ema.id === 'fast' ? p.fast : p.slow;
            if (val === null || !Number.isFinite(p.time)) return false;
            const d = new Date(p.time * 1000).getUTCDay();
            if (d === 0 || d === 6 || seenT.has(p.time)) return false;
            seenT.add(p.time);
            return true;
          })
          .sort((a, b) => a.time - b.time)
          .map(p => ({ time: p.time as Time, value: (ema.id === 'fast' ? p.fast : p.slow) as number }));
        series.setData(data);
      }
      return;
    }

    // Live chart: no backend EMAs supplied — compute locally from the candles.
    const seen = new Set<number>();
    const filteredCandles = candlesRef.current
      .filter(c => {
        const d = new Date(c.time * 1000).getUTCDay();
        if (d === 0 || d === 6) return false;
        if (!Number.isFinite(c.time) || seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);
    for (const ema of currentEmas) {
      const series = emaSeriesRef.current.get(ema.id)!;
      series.setData(calcEma(filteredCandles, ema.period));
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !overlayRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d0d0d' },
        textColor: '#666666',
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
      },
      localization: {
        timeFormatter: (time: number) => {
          const d = new Date((time - DISPLAY_TIME_SHIFT_SEC) * 1000);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
        },
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#f5a623', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#f5a623', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, type: TickMarkType) => {
          if (liveCandleTimeRef.current !== null && time === liveCandleTimeRef.current) return '';
          const d = new Date((time - DISPLAY_TIME_SHIFT_SEC) * 1000);
          if (type === TickMarkType.Year) return String(d.getUTCFullYear());
          if (type === TickMarkType.Month) {
            return d.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
          }
          if (type === TickMarkType.DayOfMonth) return String(d.getUTCDate());
          const hh = String(d.getUTCHours()).padStart(2, '0');
          const mm = String(d.getUTCMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#4caf84',
      downColor: '#e05c5c',
      borderUpColor: 'rgba(255,255,255,0.8)',
      borderDownColor: 'rgba(255,255,255,0.8)',
      wickUpColor: 'rgba(255,255,255,0.8)',
      wickDownColor: 'rgba(255,255,255,0.8)',
      priceLineColor: 'rgba(180,180,180,0.4)',
      priceLineWidth: 1,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    if (overlayRef.current && containerRef.current) {
      overlayRef.current.width = containerRef.current.clientWidth;
      overlayRef.current.height = containerRef.current.clientHeight;
    }

    // trendline canvas
    const trendlineCanvas = trendlineCanvasRef.current;
    if (trendlineCanvas && containerRef.current) {
      trendlineCanvas.width = containerRef.current.clientWidth;
      trendlineCanvas.height = containerRef.current.clientHeight;
      const manager = new DrawingManager(trendlineCanvas, chart, series);
      manager.setOnSelectionChange(setHasSelection);
      manager.setOnCountChange(count => setHasDrawings(count > 0));
      manager.setOnChange(() => onDrawingsChangeRef.current?.(manager.getPersisted()));
      if (trendlineAppearanceRef.current) manager.setAppearance(trendlineAppearanceRef.current);
      trendlineManagerRef.current = manager;
      if (candlesRef.current.length > 0) {
        const filtered = candlesRef.current.filter(c => {
          const d = new Date(c.time * 1000).getUTCDay();
          return d !== 0 && d !== 6;
        });
        manager.setCandleIndex(filtered);
      }
    }

    chart.subscribeCrosshairMove((param) => {
      const bar = param.seriesData.get(series) as { open: number; high: number; low: number; close: number } | undefined;
      setHoverOhlc(bar && bar.open !== undefined ? bar : null);

      // Entry tooltip: show when the cursor is near an entry marker. Match
      // mostly by X (the entry candle column) with a generous Y window, so it
      // triggers over both the white entry tick and the arrow below the bar.
      const pt = param.point;
      if (pt) {
        const RX = 8;
        const RY = 40;
        let best: EntryPoint | null = null;
        let bestDx = RX + 1;
        for (const ep of entryPointsRef.current) {
          const dx = Math.abs(ep.x - pt.x);
          const dy = Math.abs(ep.y - pt.y);
          if (dx <= RX && dy <= RY && dx < bestDx) { bestDx = dx; best = ep; }
        }
        setEntryTip(best ? { left: best.x, top: best.y, p: best } : null);
      } else {
        setEntryTip(null);
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      drawRollovers();
      if (!range || isLoadingMoreRef.current) return;
      if (range.from <= 30 && onLoadMoreRef.current) {
        isLoadingMoreRef.current = true;
        onLoadMoreRef.current();
      } else if (hasNewerRef.current && onLoadNewerRef.current && range.to >= candlesRef.current.length - 30) {
        isLoadingMoreRef.current = true;
        onLoadNewerRef.current();
      }
    });

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !overlayRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      chart.resize(w, h);
      overlayRef.current.width = w;
      overlayRef.current.height = h;
      if (trendlineCanvasRef.current) {
        trendlineCanvasRef.current.width = w;
        trendlineCanvasRef.current.height = h;
        trendlineManagerRef.current?.redraw();
      }
      drawRollovers();
    });
    ro.observe(containerRef.current);

    // The canvas overlay repaints on logical-range / resize events but misses
    // vertical (price-scale) rescales. Watch for scale changes each frame and
    // only repaint when something actually moved, so we don't burn CPU idling.
    let rafId = 0;
    let lastKey = '';
    const tick = () => {
      if (backtestOverlayRef.current && chartRef.current && seriesRef.current) {
        const lr = chartRef.current.timeScale().getVisibleLogicalRange();
        // sample the price at a fixed pixel to detect vertical scale/scroll cheaply
        const p = seriesRef.current.coordinateToPrice(50);
        const key = `${lr?.from ?? ''},${lr?.to ?? ''},${p ?? ''}`;
        if (key !== lastKey) {
          lastKey = key;
          drawRolloversRef.current();
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      trendlineManagerRef.current?.destroy();
      trendlineManagerRef.current = null;
      markersRef.current?.detach();
      markersRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      emaSeriesRef.current.clear();
    };
  }, [drawRollovers]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;

    const oldCandles = candlesRef.current;
    // A sliding-window update (older/newer) preserves the view; anything else
    // resets it. Fall back to the legacy prepend heuristic when candlesKind is
    // absent (live chart).
    const isWindow = candlesKind === 'older' || candlesKind === 'newer';
    const isPrepend = candlesKind === undefined && oldCandles.length > 0 && candles[0].time < oldCandles[0].time;
    const preserve = isWindow || isPrepend;

    const filterWeekend = (arr: Candle[]) =>
      arr.filter(c => { const d = new Date(c.time * 1000).getUTCDay(); return d !== 0 && d !== 6; });

    // Re-anchor on the first visible candle's TIME so trims on either side don't
    // shift the view.
    let anchorTime: number | null = null;
    let anchorOffset = 0;
    if (preserve && chartRef.current) {
      const vr = chartRef.current.timeScale().getVisibleLogicalRange();
      if (vr) {
        const oldFiltered = filterWeekend(oldCandles);
        const fromIdx = Math.max(0, Math.round(vr.from));
        anchorTime = oldFiltered[fromIdx]?.time ?? null;
        anchorOffset = vr.to - vr.from;
      }
    }

    candlesRef.current = candles;
    timeframeRef.current = timeframe;

    const precision = getPricePrecision(symbol);
    precisionRef.current = precision;
    seriesRef.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) },
    });
    // pip = 10 × minMove (EURUSD 0.0001, USDJPY 0.01, XAUUSD 0.1)
    trendlineManagerRef.current?.setPipSize(Math.pow(10, -(precision - 1)));

    const filteredNew = filterWeekend(candles);
    const seen = new Set<number>();
    const data: CandlestickData[] = filteredNew
      .filter(c => Number.isFinite(c.time) && !seen.has(c.time) && seen.add(c.time) !== undefined)
      .sort((a, b) => a.time - b.time)
      .map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    if (data.length === 0) return;
    seriesRef.current.setData(data);

    if (preserve && chartRef.current) {
      // A focus is pending (double-click) and its candles may have just arrived
      // via pagination — honour it instead of restoring the previous viewport.
      if (pendingFocusRef.current) {
        applyFocus();
      } else if (anchorTime !== null) {
        const newFromIdx = data.findIndex(d => (d.time as number) >= anchorTime!);
        if (newFromIdx >= 0) {
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: newFromIdx,
            to: newFromIdx + anchorOffset,
          });
        }
      }
      isLoadingMoreRef.current = false;
    } else if (chartRef.current && containerRef.current) {
      seriesRef.current.priceScale().applyOptions({ autoScale: true });
      const barSpacing = 6;
      chartRef.current.timeScale().applyOptions({ barSpacing });
      if (pendingFocusRef.current) {
        // A focus is pending (double-click) — honour it instead of scrolling to end.
        applyFocus();
      } else if (candlesKind !== 'around') {
        // An 'around' update comes from a double-click focus; never scroll to end
        // for it, or it would undo a focus that was already applied.
        const visibleBars = Math.floor(containerRef.current.clientWidth / barSpacing);
        chartRef.current.timeScale().scrollToPosition(Math.floor(visibleBars * 0.3), false);
      }
    }

    const manager = trendlineManagerRef.current;
    if (manager) {
      manager.setCandleIndex(filteredNew);
      const pending = initialDrawingsRef.current;
      if (Array.isArray(pending) && loadedDrawingsRef.current !== pending) {
        loadedDrawingsRef.current = pending;
        manager.loadPersisted(pending);
      }
    }
    syncEmaSeries();
    drawRollovers();
  }, [candles, candlesKind, drawRollovers, syncEmaSeries, applyFocus]);

  useEffect(() => {
    emasRef.current = emas;
    syncEmaSeries();
  }, [emas, emaData, syncEmaSeries]);

  useEffect(() => {
    if (!seriesRef.current || !liveCandle) return;

    const data = candlesRef.current;
    if (data.length < 2) return;
    const lastTime = data[data.length - 1].time;
    const interval = lastTime - data[data.length - 2].time;
    if (interval <= 0) return;

    // Use the tick's real candle time so the live candle advances even when the
    // historical feed lags (it persists closed candles only every ~30s). m5_time/
    // h1_time arrive in ms on the same broker-time base as candles[].time (which
    // is in seconds), so convert to seconds and snap to the timeframe grid. Floor
    // at lastTime+interval so it never overlaps the last closed historical candle.
    const rawSec = Math.floor(liveCandle.time / 1000);
    const aligned = Math.floor(rawSec / interval) * interval;
    const liveTime = Math.max(aligned, lastTime + interval);

    liveCandleTimeRef.current = liveTime;
    try {
      seriesRef.current.update({
        time: liveTime as Time,
        open: liveCandle.open,
        high: liveCandle.high,
        low: liveCandle.low,
        close: liveCandle.close,
      });
    } catch {
      // skip silently
    }
  }, [liveCandle]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current.values()) series.removePriceLine(line);
    priceLinesRef.current = new Map();

    const levels: Omit<PositionLabel, 'top' | 'visible'>[] = [];
    const markers: SeriesMarker<Time>[] = [];
    const draggable: DraggableLevel[] = [];
    const precision = precisionRef.current;
    const candleData = candlesRef.current;

    for (const p of positions ?? []) {
      const isBuy = isBuySide(p.type);
      const pending = isPending(p.type);
      const entryColor = isBuy ? '#4caf84' : '#e05c5c';

      const addLine = (id: string, price: number, color: string, text: string) => {
        priceLinesRef.current.set(id, series.createPriceLine({
          price,
          color,
          lineWidth: selectedLevelIdRef.current === id ? 2 : 1,
          lineStyle: selectedLevelIdRef.current === id ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: false,
        }));
        levels.push({ id, ticket: p.ticket, price, color, text });
      };

      // resolve optimistic overrides: while dragging this level use its live
      // price; after release keep the dragged price until server feedback matches.
      const resolve = (id: string, serverPrice: number) => {
        const drag = dragStateRef.current;
        if (drag && drag.level.id === id) return drag.currentPrice;
        const pending = pendingPriceRef.current.get(id);
        if (pending === undefined) return serverPrice;
        if (Math.abs(pending - serverPrice) < Math.pow(10, -precision)) {
          pendingPriceRef.current.delete(id);
          return serverPrice;
        }
        return pending;
      };

      const slId = `${p.ticket}-sl`;
      const tpId = `${p.ticket}-tp`;
      const slPrice = resolve(slId, p.sl);
      const tpPrice = resolve(tpId, p.tp);

      // P&L appended to each level label, in the user's pnlMode:
      // entry = current P&L, SL/TP = P&L if closed at that price.
      const withPnl = (base: string, pnl: string) => (pnl ? `${base}  ${pnl}` : base);

      // Pending orders aren't in the market: show the order type, no P&L.
      const entryText = pending
        ? `${TYPE_LABEL[p.type].toUpperCase()} ${fmtLots(p.lots)} @ ${fmtPrice(p.openPrice, precision)}`
        : withPnl(`${isBuy ? 'BUY' : 'SELL'} ${fmtLots(p.lots)} @ ${fmtPrice(p.openPrice, precision)}`, formatEntryPnl(p, pnlMode, accountBalance));

      addLine(`${p.ticket}-entry`, p.openPrice, entryColor, entryText);
      // Pending orders aren't in the market: SL/TP show the price only, no P&L.
      const slText = `SL ${fmtPrice(slPrice, precision)}`;
      const tpText = `TP ${fmtPrice(tpPrice, precision)}`;
      if (slPrice) addLine(slId, slPrice, '#f2a0a0', pending ? slText : withPnl(slText, formatLevelPnl(p, pnlMode, accountBalance, slPrice)));
      if (tpPrice) addLine(tpId, tpPrice, '#8fd9bd', pending ? tpText : withPnl(tpText, formatLevelPnl(p, pnlMode, accountBalance, tpPrice)));

      const base = { ticket: p.ticket, broker: p.broker ?? '', symbol: p.symbol, lots: p.lots, sl: slPrice, tp: tpPrice };
      if (slPrice) draggable.push({ ...base, id: slId, kind: 'sl', price: slPrice });
      if (tpPrice) draggable.push({ ...base, id: tpId, kind: 'tp', price: tpPrice });

      // Entry arrow marks where a market position opened; skip it for pendings.
      const openSec = pending ? 0 : openTimeToUtcSec(p.openTime, 0);
      if (openSec > 0 && candleData.length > 0) {
        let candleTime: number | null = null;
        for (let i = candleData.length - 1; i >= 0; i--) {
          if (candleData[i].time <= openSec) { candleTime = candleData[i].time; break; }
        }
        if (candleTime !== null) {
          markers.push({
            time: candleTime as Time,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: entryColor,
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            size: 1,
          });
        }
      }
    }

    // Backtest entries/exits are drawn on the canvas overlay (arrow at the
    // entry price, X/check at the exit), not as native series markers.

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current?.detach();
    markersRef.current = createSeriesMarkers(series, markers);

    if (selectedLevelIdRef.current && !draggable.some(l => l.id === selectedLevelIdRef.current)) {
      selectedLevelIdRef.current = null;
    }
    draggableRef.current = draggable;
    positionLevelsRef.current = levels;
    repositionLabels();
  }, [positions, candles, repositionLabels, accountBalance, pnlMode, backtestOverlay]);

  // drag SL/TP lines directly on the chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const HIT_PX = 6;

    const yToClientOffset = (clientY: number) => {
      const rect = container.getBoundingClientRect();
      return clientY - rect.top;
    };

    const findHit = (clientY: number): DraggableLevel | null => {
      const series = seriesRef.current;
      if (!series) return null;
      const y = yToClientOffset(clientY);
      let best: DraggableLevel | null = null;
      let bestDist = HIT_PX;
      for (const lvl of draggableRef.current) {
        const ly = series.priceToCoordinate(lvl.price);
        if (ly === null) continue;
        const dist = Math.abs(ly - y);
        if (dist < bestDist) { bestDist = dist; best = lvl; }
      }
      return best;
    };

    const applyDragPrice = (price: number) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      drag.currentPrice = price;
      const line = priceLinesRef.current.get(drag.level.id);
      line?.applyOptions({ price });
      // live label update
      const prefix = drag.level.kind === 'sl' ? 'SL' : 'TP';
      setPositionLabels(prev => prev.map(l =>
        l.id === drag.level.id ? { ...l, price, text: `${prefix} ${fmtPrice(price, precisionRef.current)}` } : l,
      ));
      repositionLabelsRef.current();
    };

    const applySelectionStyle = (id: string, selected: boolean) => {
      priceLinesRef.current.get(id)?.applyOptions({
        lineWidth: selected ? 2 : 1,
        lineStyle: selected ? LineStyle.Solid : LineStyle.Dashed,
      });
    };

    const setSelectedLevel = (id: string | null) => {
      const prev = selectedLevelIdRef.current;
      if (prev === id) return;
      if (prev) applySelectionStyle(prev, false);
      if (id) applySelectionStyle(id, true);
      selectedLevelIdRef.current = id;
    };

    // Two-step interaction: pointer-down on an unselected level only selects
    // it; dragging starts on a level that is already selected. Pointer-down
    // away from any level deselects.
    const startDrag = (clientY: number): boolean => {
      const hit = findHit(clientY);
      if (!hit) {
        setSelectedLevel(null);
        return false;
      }
      if (selectedLevelIdRef.current !== hit.id) {
        setSelectedLevel(hit.id);
        return true;
      }
      dragStateRef.current = { level: hit, currentPrice: hit.price };
      chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
      container.style.cursor = 'ns-resize';
      return true;
    };

    const moveDrag = (clientY: number) => {
      const series = seriesRef.current;
      const drag = dragStateRef.current;
      if (!series || !drag) return;
      const price = series.coordinateToPrice(yToClientOffset(clientY));
      if (price === null) return;
      applyDragPrice(price);
    };

    const endDrag = () => {
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
      container.style.cursor = '';
      if (!drag) return;
      const { level, currentPrice } = drag;
      const sl = level.kind === 'sl' ? currentPrice : level.sl;
      const tp = level.kind === 'tp' ? currentPrice : level.tp;
      // keep the dragged value optimistically until server feedback matches
      pendingPriceRef.current.set(level.id, currentPrice);
      onModifyRef.current?.(level.ticket, sl, tp);
    };

    const onMouseDown = (e: MouseEvent) => { if (startDrag(e.clientY)) { e.preventDefault(); e.stopPropagation(); } };
    const onMouseMove = (e: MouseEvent) => {
      if (dragStateRef.current) { moveDrag(e.clientY); return; }
      // hover affordance
      container.style.cursor = findHit(e.clientY) ? 'ns-resize' : '';
    };
    const onMouseUp = () => { if (dragStateRef.current) endDrag(); };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && startDrag(t.clientY)) { e.preventDefault(); e.stopPropagation(); }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current) return;
      const t = e.touches[0];
      if (t) { e.preventDefault(); moveDrag(t.clientY); }
    };
    const onTouchEnd = () => { if (dragStateRef.current) endDrag(); };

    container.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    container.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd, true);

    return () => {
      container.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      container.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.chart}>
      <canvas ref={overlayRef} className={styles.overlay} />
      <canvas ref={trendlineCanvasRef} className={styles.trendlineCanvas} />
      {symbol && (
        <div className={styles.legend}>
          <span
            className={styles.legendClickable}
            data-chart-interactive
            {...doubleTapProps('broker', () => navigate(`/journal?broker=${encodeURIComponent(broker)}`))}
            title="Double-click/tap to filter by broker"
          >
            {broker.toUpperCase()}
          </span>
          <span className={styles.legendSep}>{' · '}</span>
          <span
            className={styles.legendClickable}
            data-chart-interactive
            {...doubleTapProps('symbol', () => navigate(`/journal?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}`))}
            title="Double-click/tap to filter by broker + symbol"
          >
            {symbol}
          </span>
          <span className={styles.legendSep}>{' · '}</span>
          <span className={styles.legendTf}>{timeframe}</span>
          {hoverOhlc && (
            <span className={styles.legendOhlc}>
              <span className={styles.legendSep}>{' · '}</span>
              O <span className={styles.legendOhlcValue}>{fmtPrice(hoverOhlc.open, precisionRef.current)}</span>{' '}
              H <span className={styles.legendOhlcValue}>{fmtPrice(hoverOhlc.high, precisionRef.current)}</span>{' '}
              L <span className={styles.legendOhlcValue}>{fmtPrice(hoverOhlc.low, precisionRef.current)}</span>{' '}
              C <span className={styles.legendOhlcValue}>{fmtPrice(hoverOhlc.close, precisionRef.current)}</span>
            </span>
          )}
        </div>
      )}
      {entryTip && (
        <div className={styles.entryTip} style={{ left: entryTip.left + 12, top: entryTip.top - 12 }}>
          <div className={styles.entryTipRow}><span>ID</span><span>{entryTip.p.id}</span></div>
          <div className={styles.entryTipRow}><span>Entry</span><span>{fmtPrice(entryTip.p.entryPrice, precisionRef.current)}</span></div>
          <div className={styles.entryTipRow}><span>SL</span><span>{fmtPrice(entryTip.p.sl, precisionRef.current)}</span></div>
          <div className={styles.entryTipRow}><span>TP</span><span>{entryTip.p.tp ? fmtPrice(entryTip.p.tp, precisionRef.current) : '—'}</span></div>
          <div className={styles.entryTipRow}><span>Time</span><span>{entryTip.p.entryTime ? entryTip.p.entryTime.slice(0, 16).replace('T', ' ') : '—'}</span></div>
        </div>
      )}
      {positionLabels.filter(l => l.visible).map(l => (
        <div
          key={l.id}
          className={styles.positionLabel}
          style={{ top: l.top, color: l.color, borderColor: l.color }}
          onDoubleClick={() => onEditPosition?.(l.ticket)}
          title="Double-click to edit"
        >
          {l.text}
          {l.id.endsWith('-entry') && (
            <button
              type="button"
              className={styles.positionCloseBtn}
              onClick={(e) => { e.stopPropagation(); onClosePosition?.(l.ticket); }}
              onDoubleClick={(e) => e.stopPropagation()}
              title="Close position"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {(showNewTrade || hasSelection || hasDrawings) && (
        <div className={styles.drawingActions}>
          {showNewTrade && (
            <button
              type="button"
              className={styles.newTradeChartBtn}
              onClick={onNewTrade}
              title="New trade"
            >
              + New Trade
            </button>
          )}
          {hasSelection && (
            <button
              type="button"
              className={styles.deleteTrendlineBtn}
              onClick={() => trendlineManagerRef.current?.deleteSelected()}
              title="Delete selected drawing"
            >
              Delete
            </button>
          )}
          {hasDrawings && (
            <button
              type="button"
              className={styles.clearDrawingsBtn}
              onClick={() => trendlineManagerRef.current?.clearAll()}
              title="Clear all drawings on this chart"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
