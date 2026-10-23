import { useEffect, useState } from 'react';
import { apiFetch, errorMessage, isAbortError } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { TIMEFRAMES, type EmaNotification, type NotificationDirection, type NotificationEvent, type NotificationInput } from '../../lib/useEmaNotifications';
import styles from '../journal/BulkEditPanel.module.css';
import own from './NotificationPanel.module.css';

interface NotificationPanelProps {
  open: boolean;
  brokers: string[];
  notification: EmaNotification | null;   // null → create
  nonce: number;                           // changes on every open, so the form restarts
  onSave: (input: NotificationInput, id: number | null) => Promise<unknown>;
  onClose: () => void;
}

interface Fields {
  broker: string;
  symbols: string[];
  all: boolean;
  timeframe: string;
  emaFast: string;
  emaSlow: string;
  event: NotificationEvent;
  thresholdPips: string;
  direction: NotificationDirection;
  repeat: 'once' | 'every';
  repeatMinutes: string;
  endsAt: string;      // dd/mm/yyyy hh:mm, local time
  note: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "dd/mm/yyyy hh:mm" in the browser's local time → ISO; null when not a date.
const parseLocalInput = (text: string): string | null => {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5] ?? '0'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const fieldsOf = (n: EmaNotification | null, brokers: string[]): Fields => ({
  broker: n?.broker ?? brokers[0] ?? '',
  symbols: n?.symbols ?? ['EURUSD'],
  all: n ? n.symbols.length === 0 : false,
  timeframe: n?.timeframe ?? 'H1',
  emaFast: String(n?.emaFast ?? 24),
  emaSlow: String(n?.emaSlow ?? 48),
  event: n?.event ?? 'both',
  thresholdPips: String(n?.thresholdPips ?? 3),
  direction: n?.direction ?? 'both',
  repeat: n && n.repeatMinutes !== null ? 'every' : 'once',
  repeatMinutes: String(n?.repeatMinutes ?? 30),
  endsAt: toLocalInput(n?.endsAt ?? null),
  note: n?.note ?? '',
});

export function NotificationPanel({ open, brokers, notification, nonce, onSave, onClose }: NotificationPanelProps) {
  const key = `${nonce}:${notification?.id ?? 'new'}`;
  const [synced, setSynced] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(notification, brokers));
  const [symbols, setSymbols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (open && synced !== key) {
    setSynced(key);
    setFields(fieldsOf(notification, brokers));
  }

  const set = <K extends keyof Fields>(k: K) => (v: Fields[K]) => setFields(f => ({ ...f, [k]: v }));

  // Every symbol the chosen broker trades, for the chips.
  useEffect(() => {
    if (!open || !fields.broker) return;
    const ac = new AbortController();
    apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(fields.broker)}`, { signal: ac.signal })
      .then(setSymbols)
      .catch(err => { if (!isAbortError(err)) setSymbols([]); });
    return () => ac.abort();
  }, [open, fields.broker]);

  const toggleSymbol = (s: string) => setFields(f => ({
    ...f, all: false,
    symbols: f.symbols.includes(s) ? f.symbols.filter(x => x !== s) : [...f.symbols, s],
  }));

  const submit = async () => {
    const emaFast = parseInt(fields.emaFast, 10);
    const emaSlow = parseInt(fields.emaSlow, 10);
    const threshold = parseFloat(fields.thresholdPips.replace(',', '.'));
    const minutes = parseInt(fields.repeatMinutes, 10);
    const endsAt = fields.endsAt.trim() === '' ? null : parseLocalInput(fields.endsAt);
    if (!fields.broker) { addToast('Choose a broker', 'error'); return; }
    if (!fields.all && fields.symbols.length === 0) { addToast('Pick at least one symbol or all symbols', 'error'); return; }
    if (!Number.isInteger(emaFast) || !Number.isInteger(emaSlow) || emaFast < 1 || emaSlow < 1 || emaFast === emaSlow) { addToast('EMA periods must be positive and different', 'error'); return; }
    if (fields.event !== 'cross' && !(threshold > 0)) { addToast('The approach threshold must be a positive number of pips', 'error'); return; }
    if (fields.repeat === 'every' && !(Number.isInteger(minutes) && minutes >= 1)) { addToast('Repeat every N minutes needs a whole number ≥ 1', 'error'); return; }
    if (fields.endsAt.trim() !== '' && endsAt === null) { addToast('Ends must be dd/mm/yyyy hh:mm', 'error'); return; }
    setBusy(true);
    try {
      await onSave({
        broker: fields.broker, symbols: fields.all ? [] : fields.symbols, timeframe: fields.timeframe, emaFast, emaSlow,
        event: fields.event, thresholdPips: fields.event === 'cross' ? (threshold > 0 ? threshold : 2) : threshold,
        direction: fields.direction, repeatMinutes: fields.repeat === 'every' ? minutes : null, endsAt, note: fields.note.trim() || null,
      }, notification?.id ?? null);
      addToast(notification ? 'Notification saved' : 'Notification created', 'success');
      onClose();
    } catch (err) {
      addToast(errorMessage(err), 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  const dirClass = (d: NotificationDirection) => fields.direction !== d ? '' : d === 'buy' ? own.segOn : d === 'sell' ? own.segOnRed : own.segOnNeutral;
  const eventClass = (e: NotificationEvent) => (fields.event === e ? own.segOnNeutral : '');

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>{notification ? `Edit notification · ${notification.id}` : 'New notification'}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          <div className={own.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Broker · candles</label>
              <select className={styles.input} value={fields.broker} onChange={e => setFields(f => ({ ...f, broker: e.target.value, symbols: [], all: false }))}>
                {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Timeframe</label>
              <select className={styles.input} value={fields.timeframe} onChange={e => set('timeframe')(e.target.value)}>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Symbols</label>
            {symbols.length === 0 ? <span className={own.empty}>No candles for this broker yet</span> : (
              <div className={own.chips}>
                {symbols.map(s => (
                  <button key={s} type="button" className={`${own.chip} ${!fields.all && fields.symbols.includes(s) ? own.chipOn : ''}`} onClick={() => toggleSymbol(s)}>{s}</button>
                ))}
              </div>
            )}
            <button type="button" className={`${own.chip} ${own.chipAll} ${fields.all ? own.chipOn : ''}`} onClick={() => setFields(f => ({ ...f, all: !f.all }))}>
              All symbols of the broker
            </button>
          </div>

          <div className={own.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>EMA fast</label>
              <input type="text" inputMode="numeric" className={styles.input} value={fields.emaFast} onChange={e => set('emaFast')(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>EMA slow</label>
              <input type="text" inputMode="numeric" className={styles.input} value={fields.emaSlow} onChange={e => set('emaSlow')(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Event</label>
            <div className={own.seg}>
              <button type="button" className={`${own.segBtn} ${eventClass('cross')}`} onClick={() => set('event')('cross')}>Cross</button>
              <button type="button" className={`${own.segBtn} ${eventClass('approach')}`} onClick={() => set('event')('approach')}>Approach</button>
              <button type="button" className={`${own.segBtn} ${eventClass('both')}`} onClick={() => set('event')('both')}>Both</button>
            </div>
          </div>

          {fields.event !== 'cross' && (
            <div className={styles.field}>
              <label className={styles.label}>Approach threshold · pips</label>
              <input type="text" inputMode="decimal" className={styles.input} value={fields.thresholdPips} onChange={e => set('thresholdPips')(e.target.value)} />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Direction</label>
            <div className={own.seg}>
              <button type="button" className={`${own.segBtn} ${dirClass('buy')}`} onClick={() => set('direction')('buy')}>Bullish</button>
              <button type="button" className={`${own.segBtn} ${dirClass('sell')}`} onClick={() => set('direction')('sell')}>Bearish</button>
              <button type="button" className={`${own.segBtn} ${dirClass('both')}`} onClick={() => set('direction')('both')}>Both</button>
            </div>
          </div>

          <div className={own.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Repeat</label>
              <select className={styles.input} value={fields.repeat} onChange={e => set('repeat')(e.target.value as Fields['repeat'])}>
                <option value="once">Once per event</option>
                <option value="every">Every N min</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Every · minutes</label>
              <input type="text" inputMode="numeric" className={styles.input} value={fields.repeatMinutes} disabled={fields.repeat !== 'every'} onChange={e => set('repeatMinutes')(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Ends <em className={own.hintInline}>· empty = no end</em></label>
            <input type="text" inputMode="numeric" className={styles.input} placeholder="dd/mm/yyyy hh:mm" value={fields.endsAt} onChange={e => set('endsAt')(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Note</label>
            <input type="text" className={styles.input} placeholder="optional" maxLength={500} value={fields.note} onChange={e => set('note')(e.target.value)} />
          </div>

          <button type="button" className={styles.submitBtn} onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : notification ? 'Save notification' : 'Create notification'}
          </button>
        </div>
      </div>
    </>
  );
}
