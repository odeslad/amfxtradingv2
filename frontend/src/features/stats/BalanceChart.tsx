import { useEffect, useRef } from 'react';
import {
  createChart, createSeriesMarkers, AreaSeries, LineStyle, CrosshairMode,
  type IChartApi, type SeriesMarker, type Time,
} from 'lightweight-charts';
import { fmtPnl } from '../journal/utils/position';
import type { CurvePoint, BalanceOperation } from './types';
import styles from './BalanceChart.module.css';

interface BalanceChartProps {
  curve: CurvePoint[];
  operations: BalanceOperation[];
  currency: string;
}

const COLOR_LINE = '#f5a623';
const COLOR_AREA_TOP = 'rgba(245, 166, 35, 0.45)';
const COLOR_AREA_BOTTOM = 'rgba(245, 166, 35, 0.03)';
const COLOR_DEPOSIT = '#4caf84';
const COLOR_WITHDRAWAL = '#e05c5c';

const toMarker = (op: BalanceOperation, currency: string): SeriesMarker<Time> => ({
  time: op.time.slice(0, 10) as Time,
  position: op.amount >= 0 ? 'aboveBar' : 'belowBar',
  shape: op.amount >= 0 ? 'arrowUp' : 'arrowDown',
  color: op.amount >= 0 ? COLOR_DEPOSIT : COLOR_WITHDRAWAL,
  text: fmtPnl(op.amount, currency),
});

export function BalanceChart({ curve, operations, currency }: BalanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: '#0d0d0d' },
        textColor: '#666666',
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#f5a623', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#f5a623', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: false,
        rightOffset: 0,
        // Default minimum is 0.5px per point: years of daily points would not fit and get clipped on the left.
        minBarSpacing: 0.01,
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: COLOR_LINE,
      topColor: COLOR_AREA_TOP,
      bottomColor: COLOR_AREA_BOTTOM,
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: true,
    });
    series.setData(curve.map(p => ({ time: p.date as Time, value: p.balance })));

    const validDays = new Set(curve.map(p => p.date));
    const markers = operations
      .filter(op => validDays.has(op.time.slice(0, 10)))
      .map(op => toMarker(op, currency))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.timeScale().fitContent());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [curve, operations, currency]);

  return <div ref={containerRef} className={styles.chart} />;
}
