import { useState } from 'react';
import type { Ema } from './chart.types';
import styles from './IndicatorsPanel.module.css';

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
  emas: Ema[];
  onEmasChange: (emas: Ema[]) => void;
}

const DEFAULT_COLORS = ['#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840', '#a78bfa', '#22d3ee'];

function nextColor(emas: Ema[]): string {
  return DEFAULT_COLORS[emas.length % DEFAULT_COLORS.length];
}

export function IndicatorsPanel({ open, onClose, emas, onEmasChange }: IndicatorsPanelProps) {
  const [newPeriod, setNewPeriod] = useState('20');

  function addEma() {
    const period = parseInt(newPeriod, 10);
    if (!period || period < 1) return;
    const ema: Ema = {
      id: crypto.randomUUID(),
      period,
      color: nextColor(emas),
      style: 'solid',
      width: 1,
    };
    onEmasChange([...emas, ema]);
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
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>EMA</span>
          </div>

          {emas.length > 0 && (
            <div className={styles.emaList}>
              {emas.map(ema => (
                <div key={ema.id} className={styles.emaRow}>
                  <label className={styles.colorSwatch} style={{ background: ema.color }}>
                    <input
                      type="color"
                      value={ema.color}
                      onChange={e => updateEma(ema.id, { color: e.target.value })}
                      className={styles.colorInput}
                    />
                  </label>

                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Period</span>
                    <input
                      type="number"
                      className={styles.periodInput}
                      value={ema.period}
                      min={1}
                      max={500}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1) updateEma(ema.id, { period: v });
                      }}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Style</span>
                    <select
                      className={styles.select}
                      value={ema.style}
                      onChange={e => updateEma(ema.id, { style: e.target.value as Ema['style'] })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Width</span>
                    <select
                      className={styles.select}
                      value={ema.width}
                      onChange={e => updateEma(ema.id, { width: parseInt(e.target.value, 10) as Ema['width'] })}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>

                  <button type="button" className={styles.removeBtn} onClick={() => removeEma(ema.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addRow}>
            <input
              type="number"
              className={styles.addPeriodInput}
              value={newPeriod}
              min={1}
              max={500}
              placeholder="Period"
              onChange={e => setNewPeriod(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addEma(); }}
            />
            <button type="button" className={styles.addBtn} onClick={addEma}>
              + Add EMA
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
