import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, LineStyle, TickMarkType, CrosshairMode,
  type IChartApi, type ISeriesApi, type CandlestickData, type Time,
} from 'lightweight-charts';
import type { Ema } from './chart.types';
import { TrendlineManager } from './TrendlineTools';
import styles from './LightweightChart.module.css';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const ROLLOVER_TIMEFRAMES = new Set(['M5', 'M15', 'H1']);

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

function getPricePrecision(candles: Candle[]): number {
  if (candles.length === 0) return 5;
  const sample = candles[Math.floor(candles.length / 2)].close.toString();
  const dot = sample.indexOf('.');
  return dot === -1 ? 0 : sample.length - dot - 1;
}

function calcEma(candles: Candle[], period: number): { time: Time; value: number }[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result: { time: Time; value: number }[] = [{ time: candles[period - 1].time as Time, value: ema }];
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time as Time, value: ema });
  }
  return result;
}

function getRolloverTimes(fromSec: number, toSec: number): number[] {
  const times: number[] = [];
  const cursor = new Date((fromSec - 86400) * 1000);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() / 1000 <= toSec + 4 * 86400) {
    const dayOfWeek = cursor.getUTCDay();
    const midnightSec = cursor.getTime() / 1000;

    if (dayOfWeek === 5) {
      const fridayLine = midnightSec + 23 * 3600;
      if (fridayLine >= fromSec && fridayLine <= toSec + 86400) times.push(fridayLine);
      const mondayLine = midnightSec + 3 * 86400;
      if (mondayLine >= fromSec && mondayLine <= toSec + 4 * 86400) times.push(mondayLine);
    } else if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const rolloverSec = midnightSec + 23 * 3600;
      if (rolloverSec >= fromSec && rolloverSec <= toSec + 86400) times.push(rolloverSec);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return times;
}

interface LightweightChartExtendedProps extends LightweightChartProps {
  trendlineActive?: boolean;
  onTrendlineDone?: () => void;
}

export function LightweightChart({ candles, broker, symbol, timeframe, liveCandle, onLoadMore, emas, trendlineActive, onTrendlineDone }: LightweightChartExtendedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
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
  const trendlineManagerRef = useRef<TrendlineManager | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const onTrendlineDoneRef = useRef(onTrendlineDone);
  useEffect(() => { onTrendlineDoneRef.current = onTrendlineDone; }, [onTrendlineDone]);

  useEffect(() => {
    if (trendlineActive) {
      trendlineManagerRef.current?.startDrawing(() => onTrendlineDoneRef.current?.());
    } else {
      trendlineManagerRef.current?.stopDrawing();
    }
  }, [trendlineActive]);

  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

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

    const rolloverTimes = getRolloverTimes(data[0].time, data[data.length - 1].time);

    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);

    for (const t of rolloverTimes) {
      const x = chart.timeScale().timeToCoordinate(t as Time);
      if (x === null) continue;
      const px = Math.round(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
  }, []);

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

    const filterWeekend = (arr: Candle[]) =>
      arr.filter(c => { const d = new Date(c.time * 1000).getUTCDay(); return d !== 0 && d !== 6; });
    const filteredCandles = filterWeekend(currentCandles);

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
          const d = new Date(time * 1000);
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
      const manager = new TrendlineManager(trendlineCanvas, chart, series);
      manager.setOnSelectionChange(setHasSelection);
      trendlineManagerRef.current = manager;
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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      emaSeriesRef.current.clear();
    };
  }, [drawRollovers]);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const oldCandles = candlesRef.current;
    const isPrepend = oldCandles.length > 0 && candles[0].time < oldCandles[0].time;

    let savedRange: { from: number; to: number } | null = null;
    if (isPrepend && chartRef.current) {
      savedRange = chartRef.current.timeScale().getVisibleLogicalRange();
    }

    candlesRef.current = candles;
    timeframeRef.current = timeframe;

    const precision = getPricePrecision(candles);
    seriesRef.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) },
    });

    const filterWeekend = (arr: Candle[]) =>
      arr.filter(c => { const d = new Date(c.time * 1000).getUTCDay(); return d !== 0 && d !== 6; });

    const filteredNew = filterWeekend(candles);
    const data: CandlestickData[] = filteredNew.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);

    if (isPrepend && savedRange && chartRef.current) {
      const prependCount = filteredNew.length - filterWeekend(oldCandles).length;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: savedRange.from + prependCount,
        to: savedRange.to + prependCount,
      });
      isLoadingMoreRef.current = false;
    } else if (!isPrepend && chartRef.current && containerRef.current) {
      seriesRef.current.priceScale().applyOptions({ autoScale: true });
      const barSpacing = 6;
      chartRef.current.timeScale().applyOptions({ barSpacing });
      const visibleBars = Math.floor(containerRef.current.clientWidth / barSpacing);
      chartRef.current.timeScale().scrollToPosition(Math.floor(visibleBars * 0.3), false);
    }

    syncEmaSeries();
    drawRollovers();
  }, [candles, drawRollovers, syncEmaSeries]);

  useEffect(() => {
    emasRef.current = emas;
    syncEmaSeries();
  }, [emas, syncEmaSeries]);

  useEffect(() => {
    if (!seriesRef.current || !liveCandle || liveCandle.time < 1_000_000_000) return;
    liveCandleTimeRef.current = liveCandle.time;
    try {
      seriesRef.current.update({
        time: liveCandle.time as Time,
        open: liveCandle.open,
        high: liveCandle.high,
        low: liveCandle.low,
        close: liveCandle.close,
      });
    } catch {
      // live candle time older than last bar — skip silently
    }
  }, [liveCandle]);

  return (
    <div ref={containerRef} className={styles.chart}>
      <canvas ref={overlayRef} className={styles.overlay} />
      <canvas ref={trendlineCanvasRef} className={styles.trendlineCanvas} />
      {symbol && <div className={styles.legend}>{broker.toUpperCase()} · {symbol} · {timeframe}</div>}
      {hasSelection && (
        <button
          type="button"
          className={styles.deleteTrendlineBtn}
          onClick={() => trendlineManagerRef.current?.deleteSelected()}
          title="Delete trendline"
        >
          Delete line
        </button>
      )}
    </div>
  );
}
