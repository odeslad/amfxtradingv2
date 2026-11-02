import { useState, memo } from 'react';
import { type Position, type TpRatio, TYPE_LABEL, TP_RATIOS, fmt, isBuySide, pricePrecision, tpForRatio } from './utils/position';
import { errorMessage } from '../../lib/api';
import { modifyCommand, sendCommands } from '../../lib/commands';
import { addToast } from '../../lib/toast';
import styles from './BulkEditPanel.module.css';

interface BulkEditPanelProps {
  open: boolean;
  positions: Position[];
  onClose: () => void;
}

export const BulkEditPanel = memo(function BulkEditPanel({ open, positions, onClose }: BulkEditPanelProps) {
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [ratio, setRatio] = useState<TpRatio | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form during render when the panel closes.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setSl(''); setTp(''); setRatio(null); setSubmitting(false); }
  }

  const first = positions[0];
  const label = first ? `${TYPE_LABEL[first.type]} ${first.symbol}` : '';
  const precision = first ? pricePrecision(first.symbol) : 5;

  // The typed SL wins over each position's own; no SL at all keeps the TP.
  const effectiveSl = (p: Position): number | null => (sl ? parseFloat(sl) : p.sl) || null;
  const ratioTpFor = (p: Position): number | null => {
    const stop = effectiveSl(p);
    return ratio !== null && stop !== null ? tpForRatio(p.openPrice, stop, isBuySide(p.type), ratio, precision) : null;
  };
  const tpFor = (p: Position): number => ratio !== null ? ratioTpFor(p) ?? p.tp : (tp ? parseFloat(tp) : p.tp);

  const ratioTps = positions.map(ratioTpFor);
  const sharedRatioTp = ratioTps.length > 0 && ratioTps.every(v => v !== null && v === ratioTps[0]) ? ratioTps[0] : null;

  const chooseRatio = (r: TpRatio) => { setRatio(r); setTp(''); };

  const handleSubmit = async () => {
    if (!sl && !tp && ratio === null) return;
    setSubmitting(true);
    try {
      await sendCommands(positions.map(p => modifyCommand(p, effectiveSl(p) ?? p.sl, tpFor(p))));
      addToast(`Modify sent for ${positions.length} position${positions.length > 1 ? 's' : ''}`, 'info');
      onClose();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to send modify commands'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Edit group</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.meta}>{label} · {positions.length} position{positions.length !== 1 ? 's' : ''}</div>
          <p className={styles.hint}>Leave a field empty to keep each position's current value.</p>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>SL</label>
              <input
                type="number"
                className={styles.input}
                value={sl}
                onChange={e => setSl(e.target.value)}
                placeholder={first ? fmt(first.sl, 5) : '0'}
                step="0.00001"
              />
            </div>
            <div className={styles.field}>
              <div className={styles.tpLabelRow}>
                <label className={styles.label}>TP</label>
                <div className={styles.ratioBtns}>
                  {TP_RATIOS.map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`${styles.ratioBtn} ${ratio === r ? styles.ratioBtnActive : ''}`}
                      onClick={() => chooseRatio(r)}
                    >
                      {r}:1
                    </button>
                  ))}
                </div>
              </div>
              {ratio === null ? (
                <input
                  type="number"
                  className={styles.input}
                  value={tp}
                  onChange={e => setTp(e.target.value)}
                  placeholder={first ? fmt(first.tp, 5) : '0.00000'}
                  step="0.00001"
                />
              ) : (
                <div className={styles.ratioChip}>
                  <span>
                    <span className={styles.ratioChipRatio}>{ratio}:1</span>
                    {sharedRatioTp !== null && ` · ${sharedRatioTp.toFixed(precision)}`}
                  </span>
                  <button type="button" className={styles.ratioChipClear} onClick={() => setRatio(null)} aria-label="Back to price">✕</button>
                </div>
              )}
            </div>
          </div>

          {ratio !== null && (
            <div className={styles.ratioPreview}>
              {positions.map((p, i) => {
                const value = ratioTps[i];
                return (
                  <div key={p.ticket} className={styles.ratioPreviewRow}>
                    <span>#{p.ticket} · {value !== null ? `open ${p.openPrice.toFixed(precision)}` : 'no SL'}</span>
                    <span className={value !== null ? styles.ratioPreviewValue : styles.ratioPreviewKept}>
                      {value !== null ? `TP ${value.toFixed(precision)}` : 'TP kept'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting || (!sl && !tp && ratio === null)}
          >
            {submitting ? 'Sending...' : `Modify ${positions.length}`}
          </button>
        </div>
      </div>
    </>
  );
});
