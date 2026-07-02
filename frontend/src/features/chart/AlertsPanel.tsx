import { useState, useEffect } from 'react';
import { usePush } from '../../lib/usePush';
import type { PriceAlert } from '../../lib/useAlerts';
import type { EmaCrossAlert, NewEmaAlert, EmaAlertDirection } from '../../lib/useEmaAlerts';
import styles from './AlertsPanel.module.css';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

interface AlertsPanelProps {
  open: boolean;
  onClose: () => void;
  broker: string;
  symbol: string;
  brokers: string[];
  symbols: string[];
  currentPrice?: number | null;
  alerts: PriceAlert[];
  onCreate: (alert: { broker: string; symbol: string; price: number; direction: 'above' | 'below' }) => Promise<void>;
  onToggle: (a: PriceAlert) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  emaAlerts: EmaCrossAlert[];
  onCreateEma: (alert: NewEmaAlert) => Promise<void>;
  onToggleEma: (a: EmaCrossAlert) => Promise<void>;
  onDeleteEma: (id: number) => Promise<void>;
}

export function AlertsPanel({ open, onClose, broker, symbol, brokers, symbols, currentPrice, alerts, onCreate, onToggle, onDelete, emaAlerts, onCreateEma, onToggleEma, onDeleteEma }: AlertsPanelProps) {
  const [tab, setTab] = useState<'price' | 'ema'>('price');
  const [formBroker, setFormBroker] = useState(broker);
  const [formSymbol, setFormSymbol] = useState(symbol);
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [saving, setSaving] = useState(false);
  const { status: pushStatus, busy: pushBusy, subscribe } = usePush();

  // EMA-cross alert form
  const [emaTf, setEmaTf] = useState('H1');
  const [emaFast, setEmaFast] = useState('24');
  const [emaSlow, setEmaSlow] = useState('48');
  const [emaDir, setEmaDir] = useState<EmaAlertDirection>('both');
  const [emaThreshold, setEmaThreshold] = useState('2');
  const [emaAllSymbols, setEmaAllSymbols] = useState(false);
  const [emaSaving, setEmaSaving] = useState(false);

  useEffect(() => { setFormBroker(broker); setFormSymbol(symbol); }, [broker, symbol]);

  const handleCreate = async () => {
    const value = parseFloat(price);
    if (!formBroker || !formSymbol || !Number.isFinite(value)) return;
    setSaving(true);
    try {
      await onCreate({ broker: formBroker, symbol: formSymbol, price: value, direction });
      setPrice('');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEma = async () => {
    const fast = parseInt(emaFast, 10);
    const slow = parseInt(emaSlow, 10);
    const threshold = parseFloat(emaThreshold);
    const targets = emaAllSymbols ? symbols : [formSymbol];
    if (!formBroker || targets.length === 0 || !Number.isInteger(fast) || !Number.isInteger(slow)
      || fast <= 0 || slow <= 0 || fast === slow || !Number.isFinite(threshold) || threshold <= 0) return;
    setEmaSaving(true);
    try {
      // One alert per symbol so each fires and re-arms independently.
      for (const sym of targets) {
        await onCreateEma({ broker: formBroker, symbol: sym, timeframe: emaTf, emaFast: fast, emaSlow: slow, direction: emaDir, thresholdPips: threshold });
      }
    } finally {
      setEmaSaving(false);
    }
  };

  const handleToggle = (a: PriceAlert) => onToggle(a);
  const handleDelete = (id: number) => onDelete(id);

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Alerts</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'price' ? styles.tabActive : ''}`}
            onClick={() => setTab('price')}
          >Price</button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'ema' ? styles.tabActive : ''}`}
            onClick={() => setTab('ema')}
          >EMA cross</button>
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

        {tab === 'price' && (<>
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
        </>)}

        {tab === 'ema' && (<>
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
              <select className={styles.input} value={formSymbol} onChange={e => setFormSymbol(e.target.value)} disabled={emaAllSymbols}>
                <option value="">Symbol</option>
                {symbols.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={emaAllSymbols} onChange={e => setEmaAllSymbols(e.target.checked)} />
            <span>Apply to all symbols ({symbols.length})</span>
          </label>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Timeframe</label>
              <select className={styles.input} value={emaTf} onChange={e => setEmaTf(e.target.value)}>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Direction</label>
              <select className={styles.input} value={emaDir} onChange={e => setEmaDir(e.target.value as EmaAlertDirection)}>
                <option value="both">Both</option>
                <option value="buy">Bullish</option>
                <option value="sell">Bearish</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>EMA fast</label>
              <input className={styles.input} type="number" inputMode="numeric" step="1" value={emaFast} onChange={e => setEmaFast(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>EMA slow</label>
              <input className={styles.input} type="number" inputMode="numeric" step="1" value={emaSlow} onChange={e => setEmaSlow(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Threshold</label>
              <input className={styles.input} type="number" inputMode="decimal" step="0.1" value={emaThreshold} placeholder="pips" onChange={e => setEmaThreshold(e.target.value)} />
            </div>
          </div>

          <button type="button" className={styles.addBtn} onClick={handleCreateEma} disabled={emaSaving}>
            {emaSaving ? 'Adding…' : emaAllSymbols ? `+ Add for ${symbols.length} symbols` : '+ Add EMA alert'}
          </button>
        </div>

        <div className={styles.list}>
          {emaAlerts.length === 0 && <div className={styles.empty}>No EMA alerts</div>}
          {emaAlerts.map(a => (
            <div key={a.id} className={`${styles.item} ${!a.enabled ? styles.itemOff : ''}`}>
              <div className={styles.itemMain}>
                <span className={styles.itemSymbol}>{a.symbol}</span>
                <span className={styles.itemBroker}>{a.broker} · {a.timeframe}</span>
              </div>
              <div className={styles.itemPrice}>
                <span className={a.direction === 'buy' ? styles.above : a.direction === 'sell' ? styles.below : ''}>
                  {a.direction === 'buy' ? '▲' : a.direction === 'sell' ? '▼' : '⇅'} {a.emaFast}/{a.emaSlow} ≤{a.thresholdPips}p
                </span>
                {a.triggeredAt && <span className={styles.triggered}>triggered</span>}
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.toggleBtn} onClick={() => onToggleEma(a)}>
                  {a.enabled ? 'Off' : 'On'}
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => onDeleteEma(a.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
        </>)}
      </div>
    </>
  );
}
