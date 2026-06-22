import styles from './ChartToolbar.module.css';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

interface ChartToolbarProps {
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  timeframe: string;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTimeframeChange: (v: string) => void;
}

export function ChartToolbar({
  brokers, symbols, broker, symbol, timeframe,
  onBrokerChange, onSymbolChange, onTimeframeChange,
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
        {/* future drawing tools */}
      </div>
    </div>
  );
}
