import { useEffect, useRef } from 'react';
import {
  createChart, AreaSeries, LineStyle, CrosshairMode,
  type IChartApi, type Time,
} from 'lightweight-charts';
import type { CurvePoint } from './types';
import styles from './BalanceChart.module.css';

interface BalanceChartProps {
  curve: CurvePoint[];
  title: string;
}

interface CurvePalette {
  line: string;
  areaTop: string;
  areaBottom: string;
}

const PALETTE_PROFIT: CurvePalette = {
  line: 'rgba(76, 175, 132, 0.85)',
  areaTop: 'rgba(76, 175, 132, 0.28)',
  areaBottom: 'rgba(76, 175, 132, 0.02)',
};
const PALETTE_LOSS: CurvePalette = {
  line: 'rgba(224, 92, 92, 0.85)',
  areaTop: 'rgba(224, 92, 92, 0.28)',
  areaBottom: 'rgba(224, 92, 92, 0.02)',
};
const COLOR_BREAKEVEN = 'rgba(255, 255, 255, 0.18)';

export function BalanceChart({ curve, title }: BalanceChartProps) {
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

    const breakeven = curve[0]?.balance ?? 0;
    const last = curve[curve.length - 1]?.balance ?? breakeven;
    const palette = last >= breakeven ? PALETTE_PROFIT : PALETTE_LOSS;

    const series = chart.addSeries(AreaSeries, {
      lineColor: palette.line,
      topColor: palette.areaTop,
      bottomColor: palette.areaBottom,
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: true,
    });
    series.setData(curve.map(p => ({ time: p.date as Time, value: p.balance })));
    series.createPriceLine({
      price: breakeven,
      color: COLOR_BREAKEVEN,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.timeScale().fitContent());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [curve]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}><span className={styles.title}>{title}</span></div>
      <div ref={containerRef} className={styles.chart} />
    </div>
  );
}
