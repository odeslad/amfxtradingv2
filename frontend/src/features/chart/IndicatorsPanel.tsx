import { useState, useRef, useEffect } from 'react';
import type { Ema } from './chart.types';
import styles from './IndicatorsPanel.module.css';

const PALETTE = [
  '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c',
  '#c8a840', '#a78bfa', '#22d3ee', '#f472b6',
  '#ef4444', '#84cc16', '#0ea5e9', '#f97316',
  '#ffffff', '#aaaaaa', '#555555', '#14b8a6',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className={styles.colorPickerWrap}>
      <button
        type="button"
        className={styles.colorSwatch}
        style={{ background: value }}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <div className={styles.colorPopover}>
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.paletteCell} ${c === value ? styles.paletteCellActive : ''}`}
              style={{ background: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
  emas: Ema[];
  onEmasChange: (emas: Ema[]) => void;
  onSave: () => Promise<void>;
}

const DEFAULT_COLORS = ['#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840', '#a78bfa', '#22d3ee'];

function nextColor(emas: Ema[]): string {
  return DEFAULT_COLORS[emas.length % DEFAULT_COLORS.length];
}

export function IndicatorsPanel({ open, onClose, emas, onEmasChange, onSave }: IndicatorsPanelProps) {
  const [newPeriod, setNewPeriod] = useState('20');
  const [newStyle, setNewStyle] = useState<Ema['style']>('solid');
  const [newWidth, setNewWidth] = useState<Ema['width']>(1);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  function addEma() {
    const period = parseInt(newPeriod, 10);
    if (!period || period < 1) return;
    onEmasChange([...emas, {
      id: crypto.randomUUID(),
      period,
      color: nextColor(emas),
      style: newStyle,
      width: newWidth,
    }]);
  }

  function updateEma(id: string, patch: Partial<Ema>) {
    onEmasChange(emas.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function removeEma(id: string) {
    onEmasChange(emas.filter(e => e.id !== id));
  }

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Indicators</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* EMA list */}
          <div>
            <div className={styles.sectionTitle}>EMA</div>
            {emas.length > 0 && (
              <div className={styles.emaList}>
                {emas.map(ema => (
                  <div key={ema.id} className={styles.emaRow}>
                    <ColorPicker value={ema.color} onChange={c => updateEma(ema.id, { color: c })} />
                    <input
                      type="number"
                      className={`${styles.input} ${styles.inputPeriod}`}
                      value={ema.period}
                      min={1}
                      max={500}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1) updateEma(ema.id, { period: v });
                      }}
                    />
                    <select
                      className={`${styles.input} ${styles.inputStyle}`}
                      value={ema.style}
                      onChange={e => updateEma(ema.id, { style: e.target.value as Ema['style'] })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                    <select
                      className={`${styles.input} ${styles.inputWidth}`}
                      value={ema.width}
                      onChange={e => updateEma(ema.id, { width: parseInt(e.target.value, 10) as Ema['width'] })}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                    <button type="button" className={styles.removeBtn} onClick={() => removeEma(ema.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add EMA form */}
          <div className={styles.addForm}>
            <div className={styles.sectionTitle}>Add EMA</div>
            <div className={styles.addFormFields}>
              <div className={styles.field}>
                <span className={styles.label}>Period</span>
                <input
                  type="number"
                  className={styles.input}
                  value={newPeriod}
                  min={1}
                  max={500}
                  onChange={e => setNewPeriod(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addEma(); }}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Style</span>
                <select
                  className={styles.input}
                  value={newStyle}
                  onChange={e => setNewStyle(e.target.value as Ema['style'])}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Width</span>
                <select
                  className={styles.input}
                  value={newWidth}
                  onChange={e => setNewWidth(parseInt(e.target.value, 10) as Ema['width'])}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </div>
            <button type="button" className={styles.addBtn} onClick={addEma}>
              + Add
            </button>
          </div>

          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>

        </div>
      </div>
    </>
  );
}
