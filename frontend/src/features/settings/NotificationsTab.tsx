import { useState } from 'react';
import { directionLabel, eventLabel, repeatLabel, symbolsLabel, type EmaNotification } from '../../lib/useEmaNotifications';
import page from './SettingsPage.module.css';
import styles from './NotificationsTab.module.css';

interface NotificationsTabProps {
  notifications: EmaNotification[];
  onToggle: (n: EmaNotification) => void;
  onEdit: (n: EmaNotification) => void;
  onDelete: (n: EmaNotification) => void;
}

const stateClass: Record<EmaNotification['state'], string> = { active: styles.active, paused: styles.paused, ended: styles.ended };
const stateLabel: Record<EmaNotification['state'], string> = { active: 'Active', paused: 'Paused', ended: 'Ended' };

const p = (n: number) => String(n).padStart(2, '0');
// Local time, as typed in the panel.
const fmtLocal = (iso: string | null, withYear = false): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}${withYear ? '/' + d.getFullYear() : ''} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const lastFiredLabel = (n: EmaNotification): string =>
  n.lastFired ? `${fmtLocal(n.lastFired.firedAt)} · ${n.lastFired.symbol} ${n.lastFired.direction === 'buy' ? 'bullish' : 'bearish'} ${n.lastFired.kind}` : '—';

function Toggle({ n, onToggle }: { n: EmaNotification; onToggle: (n: EmaNotification) => void }) {
  return (
    <label className={page.toggle} onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={n.enabled} onChange={() => onToggle(n)} aria-label="Active" />
      <span className={page.toggleTrack}><span className={page.toggleThumb} /></span>
    </label>
  );
}

function Card({ n, onToggle, onEdit, onDelete }: { n: EmaNotification } & Omit<NotificationsTabProps, 'notifications'>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${styles.card} ${expanded ? styles.cardExpanded : ''} ${n.state === 'active' ? '' : page.dim}`}>
      <button type="button" className={`${styles.summary} ${expanded ? styles.summaryActive : ''}`} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
        <Toggle n={n} onToggle={onToggle} />
        <span className={`${styles.symbols} ${n.direction === 'buy' ? styles.buy : n.direction === 'sell' ? styles.sell : ''}`}>{symbolsLabel(n.symbols)}</span>
        <span className={`${styles.badge} ${stateClass[n.state]}`}>{stateLabel[n.state]}</span>
      </button>
      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}><span className={styles.label}>Timeframe · EMAs</span><span>{n.timeframe} · {n.emaFast} / {n.emaSlow}</span></div>
          <div className={styles.field}><span className={styles.label}>Event</span><span>{eventLabel(n)}</span></div>
          <div className={styles.field}><span className={styles.label}>Direction</span><span className={n.direction === 'buy' ? styles.buy : n.direction === 'sell' ? styles.sell : ''}>{directionLabel(n.direction)}</span></div>
          <div className={styles.field}><span className={styles.label}>Repeat</span><span>{repeatLabel(n.repeatMinutes)}</span></div>
          <div className={styles.field}><span className={styles.label}>Ends</span><span>{fmtLocal(n.endsAt, true)}</span></div>
          <div className={styles.field}><span className={styles.label}>Broker</span><span className={page.broker}>{n.broker}</span></div>
          <div className={styles.field}><span className={styles.label}>Last fired</span><span className={page.muted}>{lastFiredLabel(n)}</span></div>
          {n.note && <div className={styles.field}><span className={styles.label}>Note</span><span>{n.note}</span></div>}
          <div className={styles.cardActions}>
            <button type="button" className={styles.editBtn} onClick={() => onEdit(n)}>Edit</button>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(n)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationsTab({ notifications, onToggle, onEdit, onDelete }: NotificationsTabProps) {
  if (notifications.length === 0) return <div className={page.empty}>No notifications yet. Create one with + New notification.</div>;

  return (
    <>
      <div className={page.tableWrapper}>
        <table className={page.table}>
          <thead>
            <tr>
              <th>On</th><th>Symbols</th><th>TF</th><th>EMAs</th><th>Event</th><th>Direction</th><th>Repeat</th><th>Ends</th><th>State</th><th>Last fired</th><th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {notifications.map(n => (
              <tr key={n.id} className={n.state === 'active' ? undefined : page.dim}>
                <td><Toggle n={n} onToggle={onToggle} /></td>
                <td>{symbolsLabel(n.symbols)}<span className={styles.brokerLine}>{n.broker}</span></td>
                <td>{n.timeframe}</td>
                <td>{n.emaFast} / {n.emaSlow}</td>
                <td className={page.sans}>{eventLabel(n)}</td>
                <td className={`${page.sans} ${n.direction === 'buy' ? styles.buy : n.direction === 'sell' ? styles.sell : ''}`}>{directionLabel(n.direction)}</td>
                <td className={page.sans}>{repeatLabel(n.repeatMinutes)}</td>
                <td className={page.muted}>{fmtLocal(n.endsAt, true)}</td>
                <td><span className={`${styles.badge} ${stateClass[n.state]}`}>{stateLabel[n.state]}</span></td>
                <td className={page.muted}>{lastFiredLabel(n)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className={styles.rowActions}>
                    <button type="button" className={styles.editBtn} onClick={() => onEdit(n)}>Edit</button>
                    <button type="button" className={styles.deleteBtn} onClick={() => onDelete(n)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {notifications.map(n => <Card key={n.id} n={n} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </>
  );
}
