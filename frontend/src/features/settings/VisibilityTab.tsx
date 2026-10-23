import type { Visibility } from '../../lib/visibility';
import type { AccountInfo } from './MirrorTab';
import styles from './SettingsPage.module.css';
import own from './VisibilityTab.module.css';

interface VisibilityTabProps {
  brokers: string[];
  accounts: Record<string, AccountInfo>;
  symbols: Record<string, string[]>;
  visibility: Visibility;
  onToggleBroker: (broker: string, visible: boolean) => void;
  onOpenSymbols: (broker: string) => void;
}

interface BrokerRow {
  broker: string;
  visible: boolean;
  hidden: number;
  total: number | null;
}

const summary = (row: BrokerRow, short = false): string => {
  if (!row.visible) return 'Hidden everywhere';
  if (row.total === null) return '…';
  if (row.hidden === 0) return `All ${row.total} ${short ? '' : 'symbols '}visible`;
  return `${row.hidden} ${short ? '' : 'symbols '}hidden · ${row.total - row.hidden} visible`;
};

function Toggle({ row, onChange, className }: { row: BrokerRow; onChange: (visible: boolean) => void; className?: string }) {
  return (
    <label className={`${styles.toggle} ${className ?? ''}`}>
      <input type="checkbox" checked={row.visible} onChange={e => onChange(e.target.checked)} aria-label={`Show ${row.broker}`} />
      <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
    </label>
  );
}

function SymbolsButton({ row, onClick, className }: { row: BrokerRow; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`${styles.barBtn} ${row.hidden > 0 ? own.symbolsBtnAttention : ''} ${className ?? ''}`}
      onClick={onClick}
      disabled={!row.visible || row.total === null}
    >
      Symbols{row.hidden > 0 ? ` · ${row.hidden} hidden` : ''}
    </button>
  );
}

export function VisibilityTab({ brokers, accounts, symbols, visibility, onToggleBroker, onOpenSymbols }: VisibilityTabProps) {
  if (brokers.length === 0) return <div className={styles.empty}>No brokers connected</div>;

  const rows: BrokerRow[] = brokers.map(broker => {
    const list = symbols[broker];
    const hiddenList = visibility.hiddenSymbols[broker] ?? [];
    return {
      broker,
      visible: !visibility.hiddenBrokers.includes(broker),
      hidden: list ? list.filter(s => hiddenList.includes(s)).length : hiddenList.length,
      total: list ? list.length : null,
    };
  });

  return (
    <>
      <p className={styles.desc}>What the app shows. Hidden brokers and symbols keep trading, alerting and notifying; they just leave the lists. Mirror and Devices always show every broker.</p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th>Broker</th><th>Visible</th><th>Account</th><th>Symbols</th><th aria-label="Actions"></th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.broker} className={row.visible ? undefined : styles.dim}>
                <td className={styles.broker}>{row.broker}</td>
                <td><Toggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} /></td>
                <td className={styles.sans}>{accounts[row.broker]?.name ?? '—'}</td>
                <td className={`${own.summary} ${row.visible && row.hidden > 0 ? own.summaryAttention : ''}`}>{summary(row)}</td>
                <td className={own.actions}><SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {rows.map(row => (
          <div key={row.broker} className={`${styles.card} ${own.card} ${row.visible ? '' : styles.dim}`}>
            <span className={own.cardMain}>
              <span className={styles.cardName}>{row.broker}</span>
              <span className={`${own.summary} ${row.visible && row.hidden > 0 ? own.summaryAttention : ''}`}>{summary(row, true)}</span>
            </span>
            {row.visible && <SymbolsButton row={row} onClick={() => onOpenSymbols(row.broker)} />}
            <Toggle row={row} onChange={visible => onToggleBroker(row.broker, visible)} className={own.cardToggle} />
          </div>
        ))}
      </div>
    </>
  );
}
