import { IconIndicators, IconFilters, IconTrendline } from '../../shared/ui/icons';
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
        <div className={styles.symbolSelects}>
          <select className={styles.select} value={broker} onChange={e => onBrokerChange(e.target.value)}>
            <option value="">Broker</option>
            {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
          </select>

          <select className={styles.select} value={symbol} onChange={e => onSymbolChange(e.target.value)} disabled={!broker}>
            <option value="">Symbol</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
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
          className={`${styles.iconBtn} ${trendlineActive ? styles.iconBtnActive : ''}`}
          onClick={onTrendline}
          title="Trendline (Shift = horizontal, Del = delete)"
          aria-label="Trendline"
        >
          <IconTrendline size={16} />
        </button>
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
          className={styles.iconBtn}
          onClick={onIndicators}
          title="Indicators"
          aria-label="Indicators"
        >
          <IconIndicators size={16} />
        </button>
      </div>
    </div>
  );
}
