import { useEffect, useRef, useCallback } from 'react';
import {
  createChart, CandlestickSeries,
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
}

function getPricePrecision(candles: Candle[]): number {
  if (candles.length === 0) return 5;
  const sample = candles[Math.floor(candles.length / 2)].close.toString();
  const dot = sample.indexOf('.');
  return dot === -1 ? 0 : sample.length - dot - 1;
}

function lastSundayOf(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function isCEST(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  const marchTransition = lastSundayOf(year, 2);
  marchTransition.setUTCHours(1, 0, 0, 0);
  const octTransition = lastSundayOf(year, 9);
  octTransition.setUTCHours(1, 0, 0, 0);
  return utcMs >= marchTransition.getTime() && utcMs < octTransition.getTime();
}

function getRolloverTimes(fromSec: number, toSec: number): number[] {
  const times: number[] = [];
  const cursor = new Date((fromSec - 86400) * 1000);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() / 1000 <= toSec + 86400) {
    const candidateMs = cursor.getTime();
    const rolloverHour = isCEST(candidateMs + 21 * 3600 * 1000) ? 21 : 22;
    const rolloverSec = candidateMs / 1000 + rolloverHour * 3600;
    if (rolloverSec >= fromSec && rolloverSec <= toSec) {
      times.push(rolloverSec);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return times;
}

export function LightweightChart({ candles, timeframe }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const timeframeRef = useRef<string>(timeframe);

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
    });

    chartRef.current = chart;
    seriesRef.current = series;

    chart.timeScale().subscribeVisibleLogicalRangeChange(drawRollovers);

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

    candlesRef.current = candles;
    timeframeRef.current = timeframe;

    const precision = getPricePrecision(candles);
    seriesRef.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) },
    });

    const data: CandlestickData[] = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);

    const timeScale = chartRef.current?.timeScale();
    if (timeScale && containerRef.current) {
      const barSpacing = 6;
      timeScale.applyOptions({ barSpacing });
      const visibleBars = Math.floor(containerRef.current.clientWidth / barSpacing);
      timeScale.scrollToPosition(Math.floor(visibleBars * 0.3), false);
    }

    drawRollovers();
  }, [candles, drawRollovers]);

  return (
    <div ref={containerRef} className={styles.chart}>
      <canvas ref={overlayRef} className={styles.overlay} />
    </div>
  );
}
