import { useState, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { newCommandId, sendCommand, type Command, type CommandAction } from '../../lib/commands';
import { subscribe } from '../../lib/ws';
import { addToast } from '../../lib/toast';
import { useVisibility, visibleSymbols, isSymbolVisible } from '../../lib/visibility';
import styles from './NewTradePanel.module.css';

interface NewTradePanelProps {
  open: boolean;
  onClose: () => void;
  // Preselect broker/symbol/timeframe when opened from the chart.
  initialBroker?: string;
  initialSymbol?: string;
  initialTimeframe?: string;
}

interface MirrorBroker {
  broker: string;
  enabled: boolean;
  lotsMode: 'fixed' | 'risk_pct';
  lots: number;
}

interface MirrorPreset {
  id: number;
  name: string;
  brokers: MirrorBroker[];
}

const PRESET_STORAGE_KEY = 'amfx.mirrorPreset';
const DEFAULT_SYMBOL = 'EURUSD';

const readStoredPresetId = (): number | null => {
  try {
    const value = Number(localStorage.getItem(PRESET_STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const storePresetId = (id: number) => {
  try { localStorage.setItem(PRESET_STORAGE_KEY, String(id)); } catch { /* storage unavailable */ }
};

// Chart symbol first, then EURUSD; brokers spell symbols in different case.
const pickDefaultSymbol = (list: string[], chartSymbol?: string): string => {
  const find = (wanted?: string) => wanted ? list.find(s => s.toUpperCase() === wanted.toUpperCase()) : undefined;
  return find(chartSymbol) ?? find(DEFAULT_SYMBOL) ?? '';
};

const ACTION_OPTIONS: CommandAction[] = ['buy', 'sell', 'buylimit', 'selllimit', 'buystop', 'sellstop'];
const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];
const DEFAULT_EMA_FAST = 24;
const DEFAULT_EMA_SLOW = 48;
const LEVEL_KEYS = ['ECC', 'EMA', 'EVL', 'MHL'] as const;

type Mode = 'manual' | 'mirror';

interface SetupLevels {
  direction: 'buy' | 'sell';
  levels: { ECC: number; EMA: number; EVL: number | null; MHL: number | null };
  pipSize: number;
}


export const NewTradePanel = memo(function NewTradePanel({ open, onClose, initialBroker, initialSymbol, initialTimeframe }: NewTradePanelProps) {
  const [mode, setMode] = useState<Mode>('manual');
  const [presets, setPresets] = useState<MirrorPreset[]>([]);
  const [presetId, setPresetId] = useState<number | null>(null);
  const [allBrokers, setBrokers] = useState<string[]>([]);
  const visibility = useVisibility();
  // Hidden brokers / symbols (spec 024) leave the lists; mirror targets are the preset's.
  const brokers = allBrokers.filter(b => !visibility.hiddenBrokers.includes(b));
  const [action, setAction] = useState<CommandAction>('buy');
  const [broker, setBroker] = useState('');
  const [symbol, setSymbol] = useState('');
  const [lots, setLots] = useState('');
  const [lotsMode, setLotsMode] = useState<'fixed' | 'risk_pct'>('fixed');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [allSymbols, setSymbols] = useState<string[]>([]);
  const preset = presets.find(p => p.id === presetId) ?? presets[0];
  const activeMirrorBrokers = (preset?.brokers ?? []).filter(m => m.enabled);
  const activeMirrorKey = activeMirrorBrokers.map(m => m.broker).join('|');
  const symbols = mode === 'manual'
    ? (broker ? visibleSymbols(visibility, broker, allSymbols) : allSymbols)
    : allSymbols.filter(s => activeMirrorBrokers.every(m => isSymbolVisible(visibility, m.broker, s)));
  const [submitting, setSubmitting] = useState(false);
  const [timeframe, setTimeframe] = useState('H1');
  const [setup, setSetup] = useState<SetupLevels | null>(null);
  const [bid, setBid] = useState<number | null>(null);
  const pendingIds = useRef<Set<string>>(new Set());
  const onCloseRef = useRef(onClose);
  const initialSymbolRef = useRef(initialSymbol);
  useEffect(() => {
    onCloseRef.current = onClose;
    initialSymbolRef.current = initialSymbol;
  });

  useEffect(() => {
    return subscribe((data) => {
      if (typeof data !== 'object' || data === null) return;
      const msg = data as { type: string; id: string; status: string; ticket?: number; error?: string };
      if (msg.type !== 'command_result') return;
      if (!pendingIds.current.has(msg.id)) return;
      pendingIds.current.delete(msg.id);
      if (pendingIds.current.size === 0) setSubmitting(false);
      // AppLayout toasts every command_result; here only the panel state changes.
      if (msg.status === 'ok') {
        setTimeout(() => onCloseRef.current(), 300);
      } else {
        setSubmitting(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<{ presets: MirrorPreset[] }>('/settings'),
      apiFetch<{ broker: string }[]>('/balances'),
    ]).then(([settings, balances]) => {
      const list = settings.presets ?? [];
      const stored = readStoredPresetId();
      setPresets(list);
      setPresetId(list.some(p => p.id === stored) ? stored : list[0]?.id ?? null);
      setBrokers(balances.map(b => b.broker));
    }).catch(() => {});
  }, [open]);

  // Preselect broker/symbol/timeframe from the chart when the panel opens.
  // Opening preselects the chart's broker/timeframe; closing resets the form.
  // Both adjust state during render on the open/close transition.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (initialBroker) setBroker(initialBroker);
      if (initialTimeframe) setTimeframe(initialTimeframe);
    } else {
      setMode('manual');
      setAction('buy');
      setBroker('');
      setSymbol('');
      setLots('');
      setLotsMode('fixed');
      setPrice('');
      setSl('');
      setTp('');
      setSetup(null);
      setBid(null);
      setSubmitting(false);
    }
  }

  // The selected symbol follows the visible list: kept while listed, else the default.
  if (symbols.length > 0 && !symbols.includes(symbol)) {
    const fallback = pickDefaultSymbol(symbols, initialSymbol);
    if (fallback !== symbol) setSymbol(fallback);
  }

  // Load symbols when broker changes (manual) or when mirror brokers change
  // No source of symbols (no broker in manual mode, no enabled mirror broker):
  // clear the list during render; the effect only fetches.
  const symbolsKey = `${mode}|${broker}|${activeMirrorKey}`;
  const [prevSymbolsKey, setPrevSymbolsKey] = useState(symbolsKey);
  if (symbolsKey !== prevSymbolsKey) {
    setPrevSymbolsKey(symbolsKey);
    if (mode === 'manual' ? !broker : !activeMirrorKey) { setSymbols([]); setSymbol(''); }
  }

  useEffect(() => {
    if (mode === 'manual') {
      if (!broker) return;
      apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(broker)}`)
        .then(setSymbols)
        .catch(() => {});
    } else {
      const mirrorNames = activeMirrorKey ? activeMirrorKey.split('|') : [];
      if (mirrorNames.length === 0) return;
      Promise.all(
        mirrorNames.map(name => apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(name)}`))
      ).then(results => {
        const [first, ...rest] = results;
        setSymbols(first.filter(s => rest.every(r => r.includes(s))));
      }).catch(() => {});
    }
  }, [broker, mode, activeMirrorKey]);
  const mirrorDisabled = !presets.some(p => p.brokers.some(m => m.enabled));
  const presetEmpty = activeMirrorBrokers.length === 0;
  const isPending = ['buylimit', 'selllimit', 'buystop', 'sellstop'].includes(action);

  // Fetch the current setup levels for the chosen broker/symbol/timeframe.
  // Levels and live bid are only meaningful for an open panel with a symbol:
  // clear them during render otherwise.
  const levelsKey = `${open}|${mode}|${broker}|${symbol}|${timeframe}`;
  const [prevLevelsKey, setPrevLevelsKey] = useState(levelsKey);
  if (levelsKey !== prevLevelsKey) {
    setPrevLevelsKey(levelsKey);
    if (!open || mode !== 'manual' || !broker || !symbol) setSetup(null);
    if (!open || !broker || !symbol) setBid(null);
  }

  useEffect(() => {
    if (!open || mode !== 'manual' || !broker || !symbol) return;
    let cancelled = false;
    apiFetch<{ setup: SetupLevels | null }>(
      `/setup-levels?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}` +
      `&tf=${timeframe}&emaFast=${DEFAULT_EMA_FAST}&emaSlow=${DEFAULT_EMA_SLOW}`,
    )
      .then(data => { if (!cancelled) setSetup(data.setup); })
      .catch(() => { if (!cancelled) setSetup(null); });
    return () => { cancelled = true; };
  }, [open, mode, broker, symbol, timeframe]);

  // Live bid for the chosen broker/symbol, to show distances to the levels.
  useEffect(() => {
    if (!open || !broker || !symbol) return;
    return subscribe((data) => {
      const m = data as { type?: string; broker?: string; ticks?: { symbol: string; bid: number }[] };
      if (m.type !== 'ticks' || m.broker !== broker || !m.ticks) return;
      const t = m.ticks.findLast(x => x.symbol === symbol);
      if (t) setBid(t.bid);
    });
  }, [open, broker, symbol]);

  const resetFeedback = () => {};

  useEffect(() => {
    if (!open) pendingIds.current.clear();
  }, [open]);

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
      const commands: Command[] = mode === 'manual'
        ? [{ ...base, id: newCommandId(), broker, lots: parseFloat(lots), lotsMode }]
        : activeMirrorBrokers.map(m => ({ ...base, id: newCommandId(), broker: m.broker, lots: m.lots, lotsMode: m.lotsMode }));
      commands.forEach(c => pendingIds.current.add(c.id));
      await Promise.all(commands.map(sendCommand));
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
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-trade-preset">Preset</label>
            <select
              id="new-trade-preset"
              className={styles.input}
              value={preset?.id ?? ''}
              onChange={e => { const id = Number(e.target.value); setPresetId(id); storePresetId(id); }}
            >
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {mode === 'mirror' && !mirrorDisabled && presetEmpty && (
          <div className={styles.mirrorWarning}>
            No brokers enabled in this preset.{' '}
            <Link to="/settings" className={styles.mirrorWarningLink} onClick={onClose}>
              Configure in Settings
            </Link>
          </div>
        )}

        {mode === 'mirror' && !mirrorDisabled && !presetEmpty && (
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

          {mode === 'manual' && broker && symbol && (
            <div className={styles.field}>
              <label className={styles.label}>Setup timeframe</label>
              <select className={styles.input} value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {mode === 'manual' && broker && symbol && (
            <div className={styles.levels}>
              <div className={styles.levelsHeader}>
                <span>Setup levels</span>
                <span className={styles.levelsQuote}>{bid !== null ? bid.toFixed(5) : '—'}</span>
              </div>
              {!setup ? (
                <div className={styles.levelsEmpty}>No current setup</div>
              ) : (
                <table className={styles.levelsTable}>
                  <tbody>
                    {LEVEL_KEYS.map(key => {
                      const val = setup.levels[key];
                      const dist = val !== null && bid !== null ? (bid - val) / setup.pipSize : null;
                      return (
                        <tr key={key} className={styles.levelRow} onClick={() => val !== null && setSl(val.toFixed(5))} title="Click to set SL to this level">
                          <td className={styles.levelName}>{key}</td>
                          <td className={styles.levelPrice}>{val !== null ? val.toFixed(5) : '—'}</td>
                          <td className={dist === null ? styles.levelDistMuted : dist >= 0 ? styles.levelDistPos : styles.levelDistNeg}>
                            {dist !== null ? `${dist > 0 ? '+' : ''}${dist.toFixed(1)}p` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

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
            disabled={submitting || (mode === 'mirror' && presetEmpty)}
          >
            {submitting ? 'Pending...' : action.toUpperCase()}
          </button>
        </form>
      </div>
    </>
  );
});
