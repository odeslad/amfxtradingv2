import { useEffect, useRef, useCallback } from 'react';
import {
  createChart, CandlestickSeries, TickMarkType,
  type IChartApi, type ISeriesApi, type CandlestickData, type Time,
} from 'lightweight-charts';
import styles from './LightweightChart.module.css';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const ROLLOVER_TIMEFRAMES = new Set(['M5', 'M15', 'H1']);

interface LightweightChartProps {
  candles: Candle[];
  timeframe: string;
  liveCandle?: Candle | null;
  onLoadMore?: () => void;
}

function getPricePrecision(candles: Candle[]): number {
  if (candles.length === 0) return 5;
  const sample = candles[Math.floor(candles.length / 2)].close.toString();
  const dot = sample.indexOf('.');
  return dot === -1 ? 0 : sample.length - dot - 1;
}


function getRolloverTimes(fromSec: number, toSec: number): number[] {
  const times: number[] = [];
  const cursor = new Date((fromSec - 86400) * 1000);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() / 1000 <= toSec + 4 * 86400) {
    const dayOfWeek = cursor.getUTCDay(); // 0=Sun, 1=Mon...5=Fri, 6=Sat
    const midnightSec = cursor.getTime() / 1000;

    if (dayOfWeek === 5) {
      // Friday: line at 23:00 broker time
      const fridayLine = midnightSec + 23 * 3600;
      if (fridayLine >= fromSec && fridayLine <= toSec + 86400) times.push(fridayLine);
      // Monday 00:00 broker time = Friday + 3 days
      const mondayLine = midnightSec + 3 * 86400;
      if (mondayLine >= fromSec && mondayLine <= toSec + 4 * 86400) times.push(mondayLine);
    } else if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Mon–Thu: rollover at 23:00 broker time
      const rolloverSec = midnightSec + 23 * 3600;
      if (rolloverSec >= fromSec && rolloverSec <= toSec + 86400) times.push(rolloverSec);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return times;
}

export function LightweightChart({ candles, timeframe, liveCandle, onLoadMore }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const timeframeRef = useRef<string>(timeframe);
  const liveCandleTimeRef = useRef<number | null>(null);
  const onLoadMoreRef = useRef<(() => void) | undefined>(undefined);
  const isLoadingMoreRef = useRef(false);

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

    ctx.strokeStyle = 'rgba(160,160,160,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

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
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1e1e1e' },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1e1e1e' },
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

    // Initialize overlay canvas size immediately
    if (overlayRef.current && containerRef.current) {
      overlayRef.current.width = containerRef.current.clientWidth;
      overlayRef.current.height = containerRef.current.clientHeight;
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
      drawRollovers();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
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
      const barSpacing = 6;
      chartRef.current.timeScale().applyOptions({ barSpacing });
      const visibleBars = Math.floor(containerRef.current.clientWidth / barSpacing);
      chartRef.current.timeScale().scrollToPosition(Math.floor(visibleBars * 0.3), false);
    }

    drawRollovers();
  }, [candles, drawRollovers]);

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
      // live candle time is older than last bar — skip silently
    }
  }, [liveCandle]);

  return (
    <div ref={containerRef} className={styles.chart}>
      <canvas ref={overlayRef} className={styles.overlay} />
    </div>
  );
}
