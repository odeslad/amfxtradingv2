import { memo, useState, type ReactNode } from 'react';
import { IconIndicators, IconFilters, IconTrendline, IconPositions, IconFullscreen, IconFullscreenExit, IconRect, IconRuler, IconMarkerUp, IconMarkerDown, IconBell, IconLock, IconUnlock, IconCross, IconCheck, IconText } from '../../shared/ui/icons';
import type { DrawMode } from './LightweightChart';
import styles from './ChartToolbar.module.css';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

export type PositionsMode = 'none' | 'all' | 'buys' | 'sells';

interface ChartToolbarProps {
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  brokerHidden?: boolean;
  symbolHidden?: boolean;
  timeframe: string;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTimeframeChange: (v: string) => void;
  onIndicators: () => void;
  onFilters: () => void;
  drawMode?: DrawMode | null;
  onDrawMode?: (mode: DrawMode) => void;
  onPositions?: () => void;
  positionsMode?: PositionsMode;
  onAlerts?: () => void;
  alertsActive?: boolean;
  alertsFlashing?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}

interface DrawTool {
  mode: DrawMode;
  title: string;
  label: string;
  icon: ReactNode;
}

const DRAW_TOOLS: DrawTool[] = [
  { mode: 'line', title: 'Trendline (Shift = horizontal, Ctrl+drag = duplicate, Del = delete)', label: 'Trendline', icon: <IconTrendline size={16} /> },
  { mode: 'rect', title: 'Rectangle', label: 'Rectangle', icon: <IconRect size={16} /> },
  { mode: 'ruler', title: 'Pip ruler (two clicks to measure, Esc/click to clear)', label: 'Pip ruler', icon: <IconRuler size={16} /> },
  { mode: 'markerBuy', title: 'Buy marker', label: 'Buy marker', icon: <IconMarkerUp size={16} /> },
  { mode: 'markerSell', title: 'Sell marker', label: 'Sell marker', icon: <IconMarkerDown size={16} /> },
  { mode: 'symbolCross', title: 'Cross mark', label: 'Cross mark', icon: <IconCross size={16} /> },
  { mode: 'symbolCheck', title: 'Check mark', label: 'Check mark', icon: <IconCheck size={16} /> },
  { mode: 'text', title: 'Text label (double-click to edit)', label: 'Text label', icon: <IconText size={16} /> },
];

export const ChartToolbar = memo(function ChartToolbar({
  brokers, symbols, broker, symbol, brokerHidden, symbolHidden, timeframe,
  onBrokerChange, onSymbolChange, onTimeframeChange, onIndicators, onFilters, drawMode, onDrawMode,
  onPositions, positionsMode = 'none', onAlerts, alertsActive, alertsFlashing, locked = false, onToggleLock, onFullscreen, isFullscreen,
}: ChartToolbarProps) {
  // Mobile only: the drawing tools live in a second row opened by Draw (spec 025).
  // Not reset when a drawing ends, so the next one is one tap away.
  const [drawOpen, setDrawOpen] = useState(false);

  return (
    <div className={styles.toolbar}>
      <div className={styles.selects}>
        <div className={styles.symbolSelects}>
          <select className={styles.select} value={broker} onChange={e => onBrokerChange(e.target.value)}>
            <option value="">Broker</option>
            {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}{brokerHidden && b === broker ? ' · hidden' : ''}</option>)}
          </select>

          <select className={styles.select} value={symbol} onChange={e => onSymbolChange(e.target.value)} disabled={!broker}>
            <option value="">Symbol</option>
            {symbols.map(s => <option key={s} value={s}>{s}{symbolHidden && s === symbol ? ' · hidden' : ''}</option>)}
          </select>
        </div>

        <div className={styles.tfGroup}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              type="button"
              className={`${styles.tfBtn} ${timeframe === tf ? styles.tfBtnActive : ''}`}
              onClick={() => onTimeframeChange(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

      </div>

      <div className={styles.tools}>
        <select
          className={`${styles.select} ${styles.tfSelect}`}
          value={timeframe}
          onChange={e => onTimeframeChange(e.target.value)}
        >
          {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
        </select>
        <button
          type="button"
          className={[
            styles.iconBtn,
            positionsMode !== 'none' ? styles.iconBtnActive : '',
            positionsMode === 'buys' ? styles.iconBtnBuys : '',
            positionsMode === 'sells' ? styles.iconBtnSells : '',
          ].join(' ')}
          onClick={onPositions}
          title={`Positions: ${positionsMode} (click to cycle none / all / buys / sells)`}
          aria-label={`Positions: ${positionsMode}`}
        >
          <IconPositions size={16} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${alertsActive ? styles.iconBtnActive : ''} ${alertsFlashing ? styles.iconBtnFlashing : ''}`}
          onClick={onAlerts}
          title="Price alerts"
          aria-label="Price alerts"
        >
          <IconBell size={16} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${locked ? styles.iconBtnActive : ''}`}
          onClick={onToggleLock}
          title={locked ? 'Unlock drawings, positions and alerts' : 'Lock drawings, positions and alerts'}
          aria-label={locked ? 'Unlock chart' : 'Lock chart'}
          aria-pressed={locked}
        >
          {locked ? <IconLock size={16} /> : <IconUnlock size={16} />}
        </button>

        <div className={`${styles.drawTools} ${drawOpen ? styles.drawToolsOpen : ''}`}>
          {DRAW_TOOLS.map(t => (
            <button
              key={t.mode}
              type="button"
              className={`${styles.iconBtn} ${drawMode === t.mode ? styles.iconBtnActive : ''}`}
              onClick={() => onDrawMode?.(t.mode)}
              title={t.title}
              aria-label={t.label}
            >
              {t.icon}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            onClick={onIndicators}
            title="Indicators"
            aria-label="Indicators"
          >
            <IconIndicators size={16} />
          </button>
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={onFilters}
          title="Filters"
          aria-label="Filters"
        >
          <IconFilters size={16} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.desktopOnly}`}
          onClick={onIndicators}
          title="Indicators"
          aria-label="Indicators"
        >
          <IconIndicators size={16} />
        </button>
        {onFullscreen && (
          <button
            type="button"
            className={`${styles.iconBtn} ${isFullscreen ? styles.iconBtnActive : ''}`}
            onClick={onFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            {isFullscreen ? <IconFullscreenExit size={16} /> : <IconFullscreen size={16} />}
          </button>
        )}
        <button
          type="button"
          className={`${styles.drawToggle} ${drawOpen ? styles.drawToggleOpen : ''}`}
          onClick={() => setDrawOpen(open => !open)}
          aria-expanded={drawOpen}
        >
          Draw
        </button>
      </div>
    </div>
  );
});
