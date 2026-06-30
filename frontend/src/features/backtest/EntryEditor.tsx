import type { EntryConfig } from './backtest.types';
import { ENTRY_TYPES } from './defaults';
import { CollapsibleSection } from './CollapsibleSection';
import { NumberInput } from './NumberInput';
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
          <NumberInput value={entry.offset} onChange={v => patch({ offset: v ?? 0 })} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Window start</label>
          <NumberInput value={entry.windowStart} onChange={v => patch({ windowStart: v ?? 0 })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Window end</label>
          <NumberInput value={entry.windowEnd} onChange={v => patch({ windowEnd: v ?? 0 })} />
        </div>
      </div>

      <CollapsibleSection title="Stop loss" bordered defaultOpen={false}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>SL type</label>
            <select className={styles.select} value={entry.sl.type} onChange={e => patchSl({ type: e.target.value as EntryConfig['sl']['type'] })}>
              <option value="fixed">Fixed</option>
              <option value="evl">EVL</option>
              <option value="mhl">MHL</option>
            </select>
          </div>
          {entry.sl.type === 'fixed' && (
            <div className={styles.field}>
              <label className={styles.label}>SL pips</label>
              <NumberInput value={entry.sl.pips} onChange={v => patchSl({ pips: v ?? 0 })} />
            </div>
          )}
          {entry.sl.type === 'evl' && (
            <div className={styles.field}>
              <label className={styles.label}>EVL offset</label>
              <NumberInput value={entry.sl.evlOffset} onChange={v => patchSl({ evlOffset: v ?? 0 })} />
            </div>
          )}
          {entry.sl.type === 'mhl' && (
            <div className={styles.field}>
              <label className={styles.label}>MHL offset</label>
              <NumberInput value={entry.sl.mhlOffset} onChange={v => patchSl({ mhlOffset: v ?? 0 })} />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Exit" bordered defaultOpen={false}>
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
              <NumberInput value={entry.exit.pips} nullable onChange={v => patchExit({ pips: v })} />
            </div>
          )}
          {entry.exit.type === 'rr' && (
            <div className={styles.field}>
              <label className={styles.label}>R:R</label>
              <NumberInput value={entry.exit.rr} nullable onChange={v => patchExit({ rr: v })} />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Trailing" bordered defaultOpen={false}>
        <div className={styles.field}>
          <label className={styles.label}>Update every</label>
          <NumberInput value={entry.trail.updateEvery} onChange={v => patchTrail({ updateEvery: v ?? 1 })} />
        </div>

        <div className={styles.divider} />

        <span className={styles.subTitle}>Activation</span>

        <div className={styles.field}>
          <label className={styles.label}>Mode</label>
          <select className={styles.select} value={entry.trail.activateMode} onChange={e => patchTrail({ activateMode: e.target.value as EntryConfig['trail']['activateMode'] })}>
            <option value="or">Or (any condition)</option>
            <option value="and">And (both conditions)</option>
          </select>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Candles</label>
            <NumberInput value={entry.trail.activateCandles} nullable placeholder="—" onChange={v => patchTrail({ activateCandles: v })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>R:R</label>
            <NumberInput value={entry.trail.toRR} nullable placeholder="—" onChange={v => patchTrail({ toRR: v })} />
          </div>
        </div>

        <div className={styles.divider} />

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
              <NumberInput value={entry.trail.distance} onChange={v => patchTrail({ distance: v ?? 0 })} />
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
          <div className={styles.field}>
            <label className={styles.label}>Offset (pips)</label>
            <NumberInput value={entry.trail.offset} onChange={v => patchTrail({ offset: v ?? 0 })} />
          </div>
        )}
      </CollapsibleSection>
    </CollapsibleSection>
  );
}
