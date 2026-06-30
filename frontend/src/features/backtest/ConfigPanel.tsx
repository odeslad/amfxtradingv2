import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api';
import type { BacktestRun, Direction, Strategy, StrategyForm, Timeframe } from './backtest.types';
import { defaultEntry, defaultForm, normalizeForm } from './defaults';
import { EntryEditor } from './EntryEditor';
import { CollapsibleSection } from './CollapsibleSection';
import { NumberInput } from './NumberInput';
import styles from './ConfigPanel.module.css';

interface Props {
  strategies: Strategy[];
  selectedId: number | null;
  running: boolean;
  onSelect: (id: number | null) => void;
  onSaved: (strategy: Strategy) => void;
  onDeleted: (id: number) => void;
  onPreview: (run: BacktestRun | null) => void;
  onPreviewStart: () => void;
}

const TIMEFRAMES: Timeframe[] = ['M5', 'M15', 'H1', 'H4', 'D1'];
const DIRECTIONS: Direction[] = ['buy', 'sell', 'both'];

export function ConfigPanel({ strategies, selectedId, running, onSelect, onSaved, onDeleted, onPreview, onPreviewStart }: Props) {
  const [broker, setBroker] = useState('');
  const [brokers, setBrokers] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [form, setForm] = useState<StrategyForm>(defaultForm);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string }[]>)
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        setBroker(prev => (prev && list.includes(prev) ? prev : list[0] ?? ''));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!broker) { setSymbols([]); return; }
    fetch(apiUrl(`/symbols?broker=${encodeURIComponent(broker)}`), { credentials: 'include' })
      .then(r => r.json() as Promise<string[]>)
      .then(setSymbols)
      .catch(() => {});
  }, [broker]);

  // Load broker/form from the selected strategy only when the SELECTION
  // changes — not on every `strategies` array refresh, which would otherwise
  // overwrite a manual broker change. Read the latest strategies via a ref.
  const strategiesRef = useRef(strategies);
  useEffect(() => { strategiesRef.current = strategies; }, [strategies]);

  useEffect(() => {
    setConfirmingDelete(false);
    const selected = strategiesRef.current.find(s => s.id === selectedId);
    if (!selected) return;
    setBroker(selected.broker);
    setForm(normalizeForm(selected.config?.forms?.[0]));
  }, [selectedId]);

  const setSetup = (partial: Partial<StrategyForm['setup']>) =>
    setForm(f => ({ ...f, setup: { ...f.setup, ...partial } }));

  const setWeak = (partial: Partial<StrategyForm['setup']['weakConfig']>) =>
    setForm(f => ({ ...f, setup: { ...f.setup, weakConfig: { ...f.setup.weakConfig, ...partial } } }));

  const setStrong = (partial: Partial<StrategyForm['setup']['strongConfig']>) =>
    setForm(f => ({ ...f, setup: { ...f.setup, strongConfig: { ...f.setup.strongConfig, ...partial } } }));

  const handleNew = () => {
    onSelect(null);
    setForm(defaultForm());
    setStatus('');
  };

  const handleSave = async (asNew = false) => {
    if (!broker || !form.instrument) { setStatus('Broker and symbol are required'); return; }
    setSaving(true);
    setStatus('');

    const config = { forms: [form] };
    const payload = { broker, symbol: form.instrument, timeframe: form.timeframe, config };
    const update = selectedId && !asNew;

    try {
      const res = update
        ? await fetch(apiUrl(`/strategies/${selectedId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ config }),
          })
        : await fetch(apiUrl('/strategies'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error(String(res.status));
      const saved = (await res.json()) as Strategy;
      onSaved(saved);
      setStatus('Saved — backtest running');
    } catch {
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!broker || !form.instrument) { setStatus('Broker and symbol are required'); return; }
    setStatus('');
    onPreviewStart();
    try {
      const res = await fetch(apiUrl('/strategies/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ broker, config: { forms: [form] } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const run = (await res.json()) as BacktestRun | null;
      onPreview(run);
      if (!run) setStatus('No candles for preview');
    } catch {
      onPreview(null);
      setStatus('Preview failed');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(apiUrl(`/strategies/${selectedId}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      onDeleted(selectedId);
    } catch {
      setStatus('Delete failed');
    } finally {
      setConfirmingDelete(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Strategy config</span>
        <button type="button" className={styles.iconBtn} onClick={handleNew} aria-label="New strategy">+ New</button>
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>Saved strategies</label>
          <select
            className={styles.select}
            value={selectedId ?? ''}
            onChange={e => onSelect(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— New strategy —</option>
            {strategies.map(s => {
              const name = s.config?.forms?.[0]?.name;
              return (
                <option key={s.id} value={s.id}>
                  #{s.id} · {name ? `${name} · ` : ''}{s.symbol} {s.timeframe}{s.active ? '' : ' (off)'}
                </option>
              );
            })}
          </select>
        </div>

        {selectedId && (
          confirmingDelete ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>Delete strategy #{selectedId}?</span>
              <button type="button" className={styles.confirmDelete} onClick={handleDelete}>Delete</button>
              <button type="button" className={styles.confirmCancel} onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>
              Delete strategy
            </button>
          )
        )}

        <div className={styles.divider} />

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Market</span>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input className={styles.input} type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Strategy name" />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Broker</label>
              <select className={styles.select} value={broker} onChange={e => setBroker(e.target.value)}>
                {brokers.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Symbol</label>
              <select className={styles.select} value={form.instrument} onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}>
                {!symbols.includes(form.instrument) && <option value={form.instrument}>{form.instrument}</option>}
                {symbols.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Timeframe</label>
            <select className={styles.select} value={form.timeframe} onChange={e => setForm(f => ({ ...f, timeframe: e.target.value as Timeframe }))}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.divider} />

        <span className={styles.sectionTitle}>Setups</span>

        <CollapsibleSection title="EMA Cross" bordered>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>EMA fast</label>
              <NumberInput value={form.setup.emaFast} onChange={v => setSetup({ emaFast: v ?? 0 })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>EMA slow</label>
              <NumberInput value={form.setup.emaSlow} onChange={v => setSetup({ emaSlow: v ?? 0 })} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Direction</label>
              <select className={styles.select} value={form.setup.direction} onChange={e => setSetup({ direction: e.target.value as Direction })}>
                {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Pivot len</label>
              <NumberInput value={form.setup.pivotLen} onChange={v => setSetup({ pivotLen: v ?? 0 })} />
            </div>
          </div>

          <div className={styles.subBlock}>
            <div className={styles.checkLine}>
              <div className={styles.checkRow}>
                <input id="weak-enabled" type="checkbox" checked={form.setup.weakConfig.enabled} onChange={e => setWeak({ enabled: e.target.checked })} />
                <label className={styles.checkLabel} htmlFor="weak-enabled">Weak candles</label>
              </div>
              {form.setup.weakConfig.enabled && (
                <div className={styles.checkRow}>
                  <input id="weak-spread" type="checkbox" checked={form.setup.weakConfig.useMaxSpread} onChange={e => setWeak({ useMaxSpread: e.target.checked })} />
                  <label className={styles.checkLabel} htmlFor="weak-spread">Limit max spread</label>
                </div>
              )}
            </div>
            {form.setup.weakConfig.enabled && form.setup.weakConfig.useMaxSpread && (
              <div className={styles.field}>
                <label className={styles.label}>Max spread (pips)</label>
                <NumberInput value={form.setup.weakConfig.maxSpreadPips} onChange={v => setWeak({ maxSpreadPips: v ?? 0 })} />
              </div>
            )}
          </div>

          <div className={styles.subBlock}>
            <div className={styles.checkLine}>
              <div className={styles.checkRow}>
                <input id="strong-enabled" type="checkbox" checked={form.setup.strongConfig.enabled} onChange={e => setStrong({ enabled: e.target.checked })} />
                <label className={styles.checkLabel} htmlFor="strong-enabled">Strong candles</label>
              </div>
              {form.setup.strongConfig.enabled && (
                <div className={styles.checkRow}>
                  <input id="strong-spread" type="checkbox" checked={form.setup.strongConfig.useMinSpread} onChange={e => setStrong({ useMinSpread: e.target.checked })} />
                  <label className={styles.checkLabel} htmlFor="strong-spread">Require min spread</label>
                </div>
              )}
            </div>
            {form.setup.strongConfig.enabled && form.setup.strongConfig.useMinSpread && (
              <div className={styles.field}>
                <label className={styles.label}>Min spread (pips)</label>
                <NumberInput value={form.setup.strongConfig.minSpreadPips} onChange={v => setStrong({ minSpreadPips: v ?? 0 })} />
              </div>
            )}
          </div>

          <div className={styles.divider} />

          <span className={styles.subTitle}>Entries</span>
          {form.entries.map((entry, i) => (
            <EntryEditor
              key={i}
              entry={entry}
              index={i}
              onChange={next => setForm(f => ({ ...f, entries: f.entries.map((e, j) => (j === i ? next : e)) }))}
              onRemove={() => setForm(f => ({ ...f, entries: f.entries.filter((_, j) => j !== i) }))}
            />
          ))}
          <button type="button" className={styles.addBtn} onClick={() => setForm(f => ({ ...f, entries: [...f.entries, defaultEntry()] }))}>
            + Add entry
          </button>
        </CollapsibleSection>

        <div className={styles.footer}>
          <div className={styles.actions}>
            <button type="button" className={styles.saveBtn} onClick={() => handleSave(false)} disabled={saving || running}>
              {running
                ? 'Running backtest…'
                : selectedId ? 'Update & re-run' : 'Create & run backtest'}
            </button>
            <button type="button" className={styles.previewBtn} onClick={handlePreview} disabled={saving || running} title="Run without saving">
              Preview
            </button>
            <button type="button" className={styles.jsonBtn} onClick={() => setShowJson(v => !v)} title="Toggle config JSON">
              {'{ }'}
            </button>
          </div>
          {selectedId && (
            <button type="button" className={styles.saveAsBtn} onClick={() => handleSave(true)} disabled={saving || running} title="Save current config as a new strategy">
              Save as new
            </button>
          )}
          {status && <span className={styles.status}>{status}</span>}
          {showJson && (
            <pre className={styles.json}>{JSON.stringify({ forms: [form] }, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
