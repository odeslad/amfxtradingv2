import type { EntryConfig } from './backtest.types';
import { ENTRY_TYPES } from './defaults';
import { CollapsibleSection } from './CollapsibleSection';
import styles from './ConfigPanel.module.css';

interface Props {
  entry: EntryConfig;
  index: number;
  onChange: (next: EntryConfig) => void;
  onRemove: () => void;
}

export function EntryEditor({ entry, index, onChange, onRemove }: Props) {
  const patch = (partial: Partial<EntryConfig>) => onChange({ ...entry, ...partial });
  const patchSl = (partial: Partial<EntryConfig['sl']>) => onChange({ ...entry, sl: { ...entry.sl, ...partial } });
  const patchExit = (partial: Partial<EntryConfig['exit']>) => onChange({ ...entry, exit: { ...entry.exit, ...partial } });
  const patchTrail = (partial: Partial<EntryConfig['trail']>) => onChange({ ...entry, trail: { ...entry.trail, ...partial } });

  return (
    <CollapsibleSection
      title={`${index + 1} · ${entry.type}`}
      bordered
      dimmed={!entry.enabled}
      defaultOpen={false}
      action={
        <div className={styles.entryActions}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={entry.enabled} onChange={e => patch({ enabled: e.target.checked })} />
            <span className={styles.checkLabel}>On</span>
          </label>
          <button type="button" className={styles.iconBtn} onClick={onRemove} aria-label="Remove entry">×</button>
        </div>
      }
    >
      <div className={styles.checkRow}>
        <input id={`invert-${entry.type}-${index}`} type="checkbox" checked={entry.invert} onChange={e => patch({ invert: e.target.checked })} />
        <label className={styles.checkLabel} htmlFor={`invert-${entry.type}-${index}`}>Invert</label>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Level</label>
          <select className={styles.select} value={entry.type} onChange={e => patch({ type: e.target.value as EntryConfig['type'] })}>
            {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Offset (pips)</label>
          <input className={styles.input} type="number" value={entry.offset} onChange={e => patch({ offset: Number(e.target.value) })} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Window start</label>
          <input className={styles.input} type="number" value={entry.windowStart} onChange={e => patch({ windowStart: Number(e.target.value) })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Window end</label>
          <input className={styles.input} type="number" value={entry.windowEnd} onChange={e => patch({ windowEnd: Number(e.target.value) })} />
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>SL type</label>
          <select className={styles.select} value={entry.sl.type} onChange={e => patchSl({ type: e.target.value as EntryConfig['sl']['type'] })}>
            <option value="fixed">Fixed</option>
            <option value="evl">EVL</option>
          </select>
        </div>
        {entry.sl.type === 'fixed' ? (
          <div className={styles.field}>
            <label className={styles.label}>SL pips</label>
            <input className={styles.input} type="number" value={entry.sl.pips} onChange={e => patchSl({ pips: Number(e.target.value) })} />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label}>EVL offset</label>
            <input className={styles.input} type="number" value={entry.sl.evlOffset} onChange={e => patchSl({ evlOffset: Number(e.target.value) })} />
          </div>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Exit type</label>
          <select className={styles.select} value={entry.exit.type} onChange={e => patchExit({ type: e.target.value as EntryConfig['exit']['type'] })}>
            <option value="none">None</option>
            <option value="fixed">Fixed</option>
            <option value="rr">R:R</option>
          </select>
        </div>
        {entry.exit.type === 'fixed' && (
          <div className={styles.field}>
            <label className={styles.label}>TP pips</label>
            <input className={styles.input} type="number" value={entry.exit.pips ?? 0} onChange={e => patchExit({ pips: Number(e.target.value) })} />
          </div>
        )}
        {entry.exit.type === 'rr' && (
          <div className={styles.field}>
            <label className={styles.label}>R:R</label>
            <input className={styles.input} type="number" value={entry.exit.rr ?? 0} onChange={e => patchExit({ rr: Number(e.target.value) })} />
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <span className={styles.subTitle}>Trailing</span>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Trail type</label>
          <select className={styles.select} value={entry.trail.type} onChange={e => patchTrail({ type: e.target.value as EntryConfig['trail']['type'] })}>
            <option value="none">None</option>
            <option value="weak">Weak</option>
            <option value="pivot">Pivot</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        {entry.trail.type === 'fixed' && (
          <div className={styles.field}>
            <label className={styles.label}>Distance (pips)</label>
            <input className={styles.input} type="number" value={entry.trail.distance} onChange={e => patchTrail({ distance: Number(e.target.value) })} />
          </div>
        )}
        {entry.trail.type === 'weak' && (
          <div className={styles.field}>
            <label className={styles.label}>Level</label>
            <select className={styles.select} value={entry.trail.level} onChange={e => patchTrail({ level: e.target.value as EntryConfig['trail']['level'] })}>
              <option value="extreme">Extreme (low/high)</option>
              <option value="close">Close</option>
            </select>
          </div>
        )}
      </div>

      {entry.trail.type !== 'none' && (
        <>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Offset (pips)</label>
              <input className={styles.input} type="number" value={entry.trail.offset} onChange={e => patchTrail({ offset: Number(e.target.value) })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Update every</label>
              <input className={styles.input} type="number" value={entry.trail.updateEvery} onChange={e => patchTrail({ updateEvery: Number(e.target.value) })} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Activate candles</label>
              <input className={styles.input} type="number" value={entry.trail.activateCandles ?? ''} placeholder="—" onChange={e => patchTrail({ activateCandles: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Activate R:R</label>
              <input className={styles.input} type="number" value={entry.trail.toRR ?? ''} placeholder="—" onChange={e => patchTrail({ toRR: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Activate mode</label>
            <select className={styles.select} value={entry.trail.activateMode} onChange={e => patchTrail({ activateMode: e.target.value as EntryConfig['trail']['activateMode'] })}>
              <option value="or">Or (any condition)</option>
              <option value="and">And (both conditions)</option>
            </select>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
