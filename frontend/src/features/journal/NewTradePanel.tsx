import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../../lib/api';
import { subscribe } from '../../lib/ws';
import { addToast } from '../../lib/toast';
import styles from './NewTradePanel.module.css';

interface NewTradePanelProps {
  open: boolean;
  onClose: () => void;
}

interface MirrorBroker {
  broker: string;
  enabled: boolean;
  lotsMode: 'fixed' | 'risk_pct';
  lots: number;
}

const ACTION_OPTIONS = ['buy', 'sell', 'buylimit', 'selllimit', 'buystop', 'sellstop'];

type Mode = 'manual' | 'mirror';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function NewTradePanel({ open, onClose }: NewTradePanelProps) {
  const [mode, setMode] = useState<Mode>('manual');
  const [mirrorBrokers, setMirrorBrokers] = useState<MirrorBroker[]>([]);
  const [brokers, setBrokers] = useState<string[]>([]);
  const [action, setAction] = useState('buy');
  const [broker, setBroker] = useState('');
  const [symbol, setSymbol] = useState('');
  const [lots, setLots] = useState('');
  const [lotsMode, setLotsMode] = useState<'fixed' | 'risk_pct'>('fixed');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pendingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    return subscribe((data) => {
      if (typeof data !== 'object' || data === null) return;
      const msg = data as { type: string; id: string; status: string; ticket?: number; error?: string };
      if (msg.type !== 'command_result') return;
      if (!pendingIds.current.has(msg.id)) return;
      pendingIds.current.delete(msg.id);
      if (pendingIds.current.size === 0) setSubmitting(false);
      if (msg.status === 'ok') {
        setTimeout(onClose, 300);
      } else {
        addToast(msg.error ?? `EA error: ${msg.status}`, 'error');
        setSubmitting(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(apiUrl('/settings'), { credentials: 'include' }).then(r => r.json() as Promise<{ mirror: MirrorBroker[] }>),
      fetch(apiUrl('/balances'), { credentials: 'include' }).then(r => r.json() as Promise<{ broker: string }[]>),
    ]).then(([settings, balances]) => {
      setMirrorBrokers(settings.mirror ?? []);
      setBrokers(balances.map(b => b.broker));
    }).catch(() => {});
  }, [open]);

  const activeMirrorBrokers = mirrorBrokers.filter(m => m.enabled);

  // Load symbols when broker changes (manual) or when mirror brokers change
  useEffect(() => {
    if (mode === 'manual') {
      if (!broker) { setSymbols([]); setSymbol(''); return; }
      fetch(apiUrl(`/symbols?broker=${encodeURIComponent(broker)}`), { credentials: 'include' })
        .then(r => r.json() as Promise<string[]>)
        .then(list => { setSymbols(list); setSymbol(''); })
        .catch(() => {});
    } else {
      if (activeMirrorBrokers.length === 0) { setSymbols([]); return; }
      Promise.all(
        activeMirrorBrokers.map(m =>
          fetch(apiUrl(`/symbols?broker=${encodeURIComponent(m.broker)}`), { credentials: 'include' })
            .then(r => r.json() as Promise<string[]>)
        )
      ).then(results => {
        const [first, ...rest] = results;
        const common = first.filter(s => rest.every(r => r.includes(s)));
        setSymbols(common);
        setSymbol('');
      }).catch(() => {});
    }
  }, [broker, mode, activeMirrorBrokers.length]);
  const mirrorDisabled = activeMirrorBrokers.length === 0;
  const isPending = ['buylimit', 'selllimit', 'buystop', 'sellstop'].includes(action);

  const resetFeedback = () => {};

  useEffect(() => {
    if (!open) {
      setMode('manual');
      setAction('buy');
      setBroker('');
      setSymbol('');
      setLots('');
      setLotsMode('fixed');
      setPrice('');
      setSl('');
      setTp('');
      setSubmitting(false);
      pendingIds.current.clear();
    }
  }, [open]);

  const sendCommand = async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/commands'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Error ${res.status}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setSubmitting(true);

    const slNum = parseFloat(sl) || 0;
    const tpNum = parseFloat(tp) || 0;
    const base = {
      action,
      symbol: symbol.toUpperCase(),
      sl: slNum,
      tp: tpNum,
      ...(isPending && price ? { price: parseFloat(price) } : {}),
    };

    if (mode === 'manual' && lotsMode === 'risk_pct' && !slNum) {
      setSubmitting(false);
      addToast('SL is required for % Risk sizing', 'error');
      return;
    }

    try {
      if (mode === 'manual') {
        const id = generateId();
        pendingIds.current.add(id);
        await sendCommand({ ...base, id, broker, lots: parseFloat(lots), lotsMode });
      } else {
        const commands = activeMirrorBrokers.map(m => ({
          ...base,
          id: generateId(),
          broker: m.broker,
          lots: m.lots,
          lotsMode: m.lotsMode,
        }));
        commands.forEach(c => pendingIds.current.add(c.id));
        await Promise.all(commands.map(sendCommand));
      }
    } catch (err) {
      setSubmitting(false);
      addToast(err instanceof Error ? err.message : 'Failed to send order', 'error');
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>New Trade</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
            onClick={() => { setMode('manual'); resetFeedback(); }}
          >
            Manual
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'mirror' ? styles.modeBtnActive : ''} ${mirrorDisabled ? styles.modeBtnDisabled : ''}`}
            onClick={() => { if (!mirrorDisabled) { setMode('mirror'); resetFeedback(); } }}
            disabled={mirrorDisabled}
          >
            Mirror
          </button>
        </div>

        {mirrorDisabled && (
          <div className={styles.mirrorWarning}>
            No brokers enabled for mirror.{' '}
            <Link to="/settings" className={styles.mirrorWarningLink} onClick={onClose}>
              Configure in Settings
            </Link>
          </div>
        )}

        {mode === 'mirror' && !mirrorDisabled && (
          <div className={styles.mirrorBrokers}>
            {activeMirrorBrokers.map(m => (
              <div key={m.broker} className={styles.mirrorBrokerRow}>
                <span className={styles.mirrorBrokerName}>{m.broker.toUpperCase()}</span>
                <span className={styles.mirrorBrokerLots}>
                  {m.lots} {m.lotsMode === 'fixed' ? 'lots' : '%'}
                </span>
              </div>
            ))}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Action</label>
            <div className={styles.actionGrid}>
              {ACTION_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.actionBtn} ${action === opt ? styles.actionBtnActive : ''} ${opt.startsWith('buy') ? styles.buy : styles.sell}`}
                  onClick={() => setAction(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {mode === 'manual' && (
            <div className={styles.field}>
              <label className={styles.label}>Broker</label>
              <select
                className={styles.input}
                value={broker}
                onChange={e => setBroker(e.target.value)}
                required
              >
                <option value="">Select broker</option>
                {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Symbol</label>
            <select
              className={styles.input}
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              required
              disabled={symbols.length === 0}
            >
              <option value="">{symbols.length === 0 ? (mode === 'manual' && !broker ? 'Select a broker first' : 'No symbols available') : 'Select symbol'}</option>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {mode === 'manual' && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Sizing</label>
                <select className={styles.input} value={lotsMode} onChange={e => setLotsMode(e.target.value as 'fixed' | 'risk_pct')}>
                  <option value="fixed">Fixed lots</option>
                  <option value="risk_pct">% Risk</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{lotsMode === 'fixed' ? 'Lots' : 'Risk %'}</label>
                <input
                  className={styles.input}
                  type="number"
                  step={lotsMode === 'fixed' ? '0.01' : '0.1'}
                  min={lotsMode === 'fixed' ? '0.01' : '0.1'}
                  value={lots}
                  onChange={e => setLots(e.target.value)}
                  placeholder={lotsMode === 'fixed' ? '0.01' : '1.0'}
                  required
                />
              </div>
            </div>
          )}

          {isPending && (
            <div className={styles.field}>
              <label className={styles.label}>Price</label>
              <input className={styles.input} type="number" step="0.00001" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00000" />
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>SL</label>
              <input className={styles.input} type="number" step="0.00001" value={sl} onChange={e => setSl(e.target.value)} placeholder="0.00000" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>TP</label>
              <input className={styles.input} type="number" step="0.00001" value={tp} onChange={e => setTp(e.target.value)} placeholder="0.00000" />
            </div>
          </div>


          <button
            type="submit"
            className={`${styles.submitBtn} ${action.startsWith('buy') ? styles.submitBuy : styles.submitSell}`}
            disabled={submitting}
          >
            {submitting ? 'Pending...' : action.toUpperCase()}
          </button>
        </form>
      </div>
    </>
  );
}
