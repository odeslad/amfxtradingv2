import styles from './SettingsPage.module.css';

export interface MirrorBroker {
  id?: number;
  broker: string;
  enabled: boolean;
  lotsMode: 'fixed' | 'risk_pct';
  lots: number;
}

export interface AccountInfo {
  name: string;
  balance: number;
  currency: string;
}

interface MirrorTabProps {
  mirror: MirrorBroker[];
  accounts: Record<string, AccountInfo>;
  onChange: (broker: string, patch: Partial<MirrorBroker>) => void;
}

const fmtBalance = (a: AccountInfo | undefined): string =>
  a ? `${a.balance.toFixed(2)} ${a.currency === 'EUR' ? '€' : a.currency}` : '—';

// Lots typed as text so the phone keyboard offers the decimal separator; the
// value is parsed on every change and an incomplete number keeps the field.
function LotsInput({ m, onChange }: { m: MirrorBroker; onChange: (patch: Partial<MirrorBroker>) => void }) {
  return (
    <input
      className={styles.input}
      type="text"
      inputMode="decimal"
      defaultValue={String(m.lots)}
      disabled={!m.enabled}
      aria-label={m.lotsMode === 'fixed' ? 'Lots' : 'Risk %'}
      onChange={e => {
        const v = parseFloat(e.target.value.replace(',', '.'));
        if (Number.isFinite(v) && v >= 0) onChange({ lots: v });
      }}
    />
  );
}

function SizingSelect({ m, onChange }: { m: MirrorBroker; onChange: (patch: Partial<MirrorBroker>) => void }) {
  return (
    <select
      className={styles.select}
      value={m.lotsMode}
      disabled={!m.enabled}
      aria-label="Sizing"
      onChange={e => onChange({ lotsMode: e.target.value as 'fixed' | 'risk_pct' })}
    >
      <option value="fixed">Fixed lots</option>
      <option value="risk_pct">% Risk</option>
    </select>
  );
}

function Toggle({ m, onChange, className }: { m: MirrorBroker; onChange: (patch: Partial<MirrorBroker>) => void; className?: string }) {
  return (
    <label className={`${styles.toggle} ${className ?? ''}`}>
      <input type="checkbox" checked={m.enabled} onChange={e => onChange({ enabled: e.target.checked })} aria-label={`Mirror ${m.broker}`} />
      <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
    </label>
  );
}

export function MirrorTab({ mirror, accounts, onChange }: MirrorTabProps) {
  if (mirror.length === 0) return <div className={styles.empty}>No brokers connected</div>;

  return (
    <>
      <p className={styles.desc}>Replicate trades across brokers. Lots per broker: fixed, or % risk over the SL distance.</p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th>Broker</th><th>Mirror</th><th>Sizing</th><th>Lots / %</th><th>Account</th><th>Balance</th></tr>
          </thead>
          <tbody>
            {mirror.map(m => (
              <tr key={m.broker} className={m.enabled ? undefined : styles.dim}>
                <td className={styles.broker}>{m.broker}</td>
                <td><Toggle m={m} onChange={patch => onChange(m.broker, patch)} /></td>
                <td><SizingSelect m={m} onChange={patch => onChange(m.broker, patch)} /></td>
                <td><LotsInput m={m} onChange={patch => onChange(m.broker, patch)} /><span className={styles.unit}>{m.lotsMode === 'fixed' ? 'lots' : '%'}</span></td>
                <td className={styles.sans}>{accounts[m.broker]?.name ?? '—'}</td>
                <td>{fmtBalance(accounts[m.broker])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {mirror.map(m => (
          <div key={m.broker} className={`${styles.card} ${m.enabled ? '' : styles.dim}`}>
            <span className={styles.cardName}>{m.broker}</span>
            <Toggle m={m} onChange={patch => onChange(m.broker, patch)} className={styles.cardToggle} />
            <SizingSelect m={m} onChange={patch => onChange(m.broker, patch)} />
            <LotsInput m={m} onChange={patch => onChange(m.broker, patch)} />
          </div>
        ))}
      </div>
    </>
  );
}
