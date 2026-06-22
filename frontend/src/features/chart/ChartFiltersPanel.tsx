import styles from './ChartFiltersPanel.module.css';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

interface ChartFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  timeframe: string;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTimeframeChange: (v: string) => void;
}

export function ChartFiltersPanel({
  open, onClose,
  brokers, symbols, broker, symbol, timeframe,
  onBrokerChange, onSymbolChange, onTimeframeChange,
}: ChartFiltersPanelProps) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Filters</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Broker</label>
            <select className={styles.input} value={broker} onChange={e => onBrokerChange(e.target.value)}>
              <option value="">Select broker</option>
              {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Symbol</label>
            <select className={styles.input} value={symbol} onChange={e => onSymbolChange(e.target.value)} disabled={!broker}>
              <option value="">Select symbol</option>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Timeframe</label>
            <div className={styles.tfGroup}>
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  type="button"
                  className={`${styles.tfBtn} ${timeframe === tf ? styles.tfBtnActive : ''}`}
                  onClick={() => { onTimeframeChange(tf); onClose(); }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
