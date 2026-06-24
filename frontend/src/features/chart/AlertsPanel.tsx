import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { usePush } from '../../lib/usePush';
import styles from './AlertsPanel.module.css';

interface PriceAlert {
  id: number;
  broker: string;
  symbol: string;
  price: number;
  direction: 'above' | 'below';
  note: string | null;
  enabled: boolean;
  triggeredAt: string | null;
}

interface AlertsPanelProps {
  open: boolean;
  onClose: () => void;
  broker: string;
  symbol: string;
  brokers: string[];
  symbols: string[];
  currentPrice?: number | null;
}

export function AlertsPanel({ open, onClose, broker, symbol, brokers, symbols, currentPrice }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [formBroker, setFormBroker] = useState(broker);
  const [formSymbol, setFormSymbol] = useState(symbol);
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [saving, setSaving] = useState(false);
  const { status: pushStatus, busy: pushBusy, subscribe } = usePush();

  const load = useCallback(() => {
    fetch(apiUrl('/alerts'), { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<PriceAlert[]> : [])
      .then(setAlerts)
      .catch(() => {});
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { setFormBroker(broker); setFormSymbol(symbol); }, [broker, symbol]);

  const handleCreate = async () => {
    const value = parseFloat(price);
    if (!formBroker || !formSymbol || !Number.isFinite(value)) return;
    setSaving(true);
    try {
      await fetch(apiUrl('/alerts'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: formBroker, symbol: formSymbol, price: value, direction }),
      });
      setPrice('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: PriceAlert) => {
    await fetch(apiUrl(`/alerts/${a.id}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    load();
  };

  const handleDelete = async (id: number) => {
    await fetch(apiUrl(`/alerts/${id}`), { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Price Alerts</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {pushStatus !== 'subscribed' && (
          <div className={styles.pushBanner}>
            {pushStatus === 'unsupported' ? (
              <span className={styles.pushNote}>
                Push not supported. On iPhone, install this app to your home screen first.
              </span>
            ) : pushStatus === 'denied' ? (
              <span className={styles.pushNote}>Notifications blocked. Enable them in your browser settings.</span>
            ) : (
              <button type="button" className={styles.enablePushBtn} onClick={subscribe} disabled={pushBusy}>
                {pushBusy ? 'Enabling…' : 'Enable push notifications'}
              </button>
            )}
          </div>
        )}

        <div className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Broker</label>
              <select className={styles.input} value={formBroker} onChange={e => setFormBroker(e.target.value)}>
                <option value="">Broker</option>
                {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Symbol</label>
              <select className={styles.input} value={formSymbol} onChange={e => setFormSymbol(e.target.value)}>
                <option value="">Symbol</option>
                {symbols.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Direction</label>
              <select className={styles.input} value={direction} onChange={e => setDirection(e.target.value as 'above' | 'below')}>
                <option value="above">Crosses above</option>
                <option value="below">Crosses below</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Price</label>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                step="0.00001"
                value={price}
                placeholder={currentPrice != null ? String(currentPrice) : '0.00000'}
                onChange={e => setPrice(e.target.value)}
              />
            </div>
          </div>

          <button type="button" className={styles.addBtn} onClick={handleCreate} disabled={saving}>
            {saving ? 'Adding…' : '+ Add alert'}
          </button>
        </div>

        <div className={styles.list}>
          {alerts.length === 0 && <div className={styles.empty}>No alerts</div>}
          {alerts.map(a => (
            <div key={a.id} className={`${styles.item} ${!a.enabled ? styles.itemOff : ''}`}>
              <div className={styles.itemMain}>
                <span className={styles.itemSymbol}>{a.symbol}</span>
                <span className={styles.itemBroker}>{a.broker}</span>
              </div>
              <div className={styles.itemPrice}>
                <span className={a.direction === 'above' ? styles.above : styles.below}>
                  {a.direction === 'above' ? '▲' : '▼'} {a.price}
                </span>
                {a.triggeredAt && <span className={styles.triggered}>triggered</span>}
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.toggleBtn} onClick={() => handleToggle(a)}>
                  {a.enabled ? 'Off' : 'On'}
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(a.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
