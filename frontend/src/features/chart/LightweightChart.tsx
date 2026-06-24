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
import { DrawingManager, type PersistedDrawing, type TrendlineAppearance, type DrawingKind, type MarkerDirection } from './DrawingTools';

import { formatEntryPnl, formatLevelPnl } from './positionRisk';
import { type PnlMode, isPending, isBuySide, TYPE_LABEL } from '../journal/utils/position';

export type DrawMode = 'line' | 'rect' | 'markerBuy' | 'markerSell';

function drawModeToKind(mode: DrawMode): { kind: DrawingKind; direction: MarkerDirection } {
  if (mode === 'rect') return { kind: 'rect', direction: 'buy' };
  if (mode === 'markerBuy') return { kind: 'marker', direction: 'buy' };
  if (mode === 'markerSell') return { kind: 'marker', direction: 'sell' };
  return { kind: 'line', direction: 'buy' };
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

function getPricePrecision(candles: Candle[]): number {
  if (candles.length === 0) return 5;
  const sample = candles[Math.floor(candles.length / 2)].close.toString();
  const dot = sample.indexOf('.');
  return dot === -1 ? 0 : sample.length - dot - 1;
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

interface LightweightChartExtendedProps extends LightweightChartProps {
  drawMode?: DrawMode | null;
  onDrawDone?: () => void;
  positions?: Position[];
  onEditPosition?: (ticket: number) => void;
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

export function LightweightChart({ candles, broker, symbol, timeframe, liveCandle, onLoadMore, emas, drawMode, onDrawDone, positions, onEditPosition, onModifyPosition, initialDrawings, onDrawingsChange, trendlineAppearance, accountBalance, pnlMode = 'net', alerts, showNewTrade, onNewTrade }: LightweightChartExtendedProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const alertsRef = useRef(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
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
  const timeframeRef = useRef<string>(timeframe);
  const liveCandleTimeRef = useRef<number | null>(null);
  const onLoadMoreRef = useRef<(() => void) | undefined>(undefined);
  const isLoadingMoreRef = useRef(false);
  const trendlineManagerRef = useRef<DrawingManager | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const positionLevelsRef = useRef<Omit<PositionLabel, 'top' | 'visible'>[]>([]);
  const draggableRef = useRef<DraggableLevel[]>([]);
  const dragStateRef = useRef<DragState | null>(null);
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
  const onDrawDoneRef = useRef(onDrawDone);
  useEffect(() => { onDrawDoneRef.current = onDrawDone; }, [onDrawDone]);

  useEffect(() => {
    if (drawMode) {
      const { kind, direction } = drawModeToKind(drawMode);
      trendlineManagerRef.current?.startDrawing(kind, () => onDrawDoneRef.current?.(), direction);
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

    if (seriesRef.current) drawAlertMarkers(ctx, chart, seriesRef.current);
  }, [drawAlertMarkers]);

  useEffect(() => { drawRolloversRef.current = drawRollovers; }, [drawRollovers]);

  const syncEmaSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const currentCandles = candlesRef.current;
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

    const seen = new Set<number>();
    const filteredCandles = currentCandles
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
      const data = calcEma(filteredCandles, ema.period);
      series.setData(data);
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

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      drawRollovers();
      if (!range || isLoadingMoreRef.current || !onLoadMoreRef.current) return;
      if (range.from <= 30) {
        isLoadingMoreRef.current = true;
        onLoadMoreRef.current();
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

    return () => {
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
    const isPrepend = oldCandles.length > 0 && candles[0].time < oldCandles[0].time;

    let savedRange: { from: number; to: number } | null = null;
    if (isPrepend && chartRef.current) {
      savedRange = chartRef.current.timeScale().getVisibleLogicalRange();
    }

    candlesRef.current = candles;
    timeframeRef.current = timeframe;

    const precision = getPricePrecision(candles);
    precisionRef.current = precision;
    seriesRef.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) },
    });

    const filterWeekend = (arr: Candle[]) =>
      arr.filter(c => { const d = new Date(c.time * 1000).getUTCDay(); return d !== 0 && d !== 6; });

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

    if (isPrepend && chartRef.current) {
      if (savedRange) {
        const prependCount = filteredNew.length - filterWeekend(oldCandles).length;
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: savedRange.from + prependCount,
          to: savedRange.to + prependCount,
        });
      }
      isLoadingMoreRef.current = false;
    } else if (!isPrepend && chartRef.current && containerRef.current) {
      seriesRef.current.priceScale().applyOptions({ autoScale: true });
      const barSpacing = 6;
      chartRef.current.timeScale().applyOptions({ barSpacing });
      const visibleBars = Math.floor(containerRef.current.clientWidth / barSpacing);
      chartRef.current.timeScale().scrollToPosition(Math.floor(visibleBars * 0.3), false);
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
  }, [candles, drawRollovers, syncEmaSeries]);

  useEffect(() => {
    emasRef.current = emas;
    syncEmaSeries();
  }, [emas, syncEmaSeries]);

  useEffect(() => {
    if (!seriesRef.current || !liveCandle) return;

    // Ignore the tick's own time (it can be unreliable). The live candle always
    // sits one interval after the last historical candle.
    const data = candlesRef.current;
    if (data.length < 2) return;
    const lastTime = data[data.length - 1].time;
    const interval = lastTime - data[data.length - 2].time;
    if (interval <= 0) return;
    const liveTime = lastTime + interval;

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
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
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

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current?.detach();
    markersRef.current = createSeriesMarkers(series, markers);

    draggableRef.current = draggable;
    positionLevelsRef.current = levels;
    repositionLabels();
  }, [positions, candles, repositionLabels, accountBalance, pnlMode]);

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

    const startDrag = (clientY: number): boolean => {
      const hit = findHit(clientY);
      if (!hit) return false;
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
