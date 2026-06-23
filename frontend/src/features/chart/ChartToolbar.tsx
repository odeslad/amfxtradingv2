import { IconIndicators } from '../../shared/ui/icons';
import styles from './ChartToolbar.module.css';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

interface ChartToolbarProps {
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  timeframe: string;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTimeframeChange: (v: string) => void;
  onIndicators: () => void;
  onFilters: () => void;
  onTrendline?: () => void;
  trendlineActive?: boolean;
}

export function ChartToolbar({
  brokers, symbols, broker, symbol, timeframe,
  onBrokerChange, onSymbolChange, onTimeframeChange, onIndicators, onFilters, onTrendline, trendlineActive,
}: ChartToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.selects}>
        <select className={styles.select} value={broker} onChange={e => onBrokerChange(e.target.value)}>
          <option value="">Broker</option>
          {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
        </select>

        <select className={styles.select} value={symbol} onChange={e => onSymbolChange(e.target.value)} disabled={!broker}>
          <option value="">Symbol</option>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

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
          className={`${styles.filtersBtn} ${trendlineActive ? styles.btnActive : ''}`}
          onClick={onTrendline}
          title="Trendline tool (Shift for horizontal, Del to delete)"
        >
          Trendline
        </button>
        <button type="button" className={styles.filtersBtn} onClick={onFilters}>
          Filters
        </button>
        <button type="button" className={styles.indicatorsBtn} onClick={onIndicators}>
          <span className={styles.indicatorsBtnText}>Indicators</span>
          <span className={styles.indicatorsBtnIcon}><IconIndicators size={14} /></span>
        </button>
      </div>
    </div>
  );
}
