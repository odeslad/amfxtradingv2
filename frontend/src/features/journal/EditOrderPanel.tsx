import { useState } from 'react';
import { type Position, fmt, fmtDistance, isBuySide, orderDistancePips, TYPE_LABEL } from './utils/position';
import { errorMessage } from '../../lib/api';
import { modifyCommand, sendCommands } from '../../lib/commands';
import { addToast } from '../../lib/toast';
import { OrderList } from './OrderList';
import styles from './BulkEditPanel.module.css';
import own from './EditOrderPanel.module.css';

interface EditOrderPanelProps {
  open: boolean;
  orders: Position[];   // one order, or a group sharing symbol and type
  onClose: () => void;
}

const parse = (v: string): number | null => (v.trim() === '' ? null : Number(v));

// The price a pending order fills at: ask for buys, bid for sells.
const fillQuote = (p: Position): number | null => (isBuySide(p.type) ? p.currentAsk : p.currentBid) ?? null;

// A limit waits behind the market and a stop ahead of it; a price on the wrong
// side is rejected by the EA, so the panel refuses it first.
function wrongSide(p: Position, price: number): string | null {
  const quote = fillQuote(p);
  if (quote === null) return null;
  const label = TYPE_LABEL[p.type].toLowerCase();
  const side = isBuySide(p.type) ? 'ask' : 'bid';
  switch (p.type) {
    case 2: return price < quote ? null : `A ${label} must sit below the ${side} (${fmt(quote, 5)})`;
    case 3: return price > quote ? null : `A ${label} must sit above the ${side} (${fmt(quote, 5)})`;
    case 4: return price > quote ? null : `A ${label} must sit above the ${side} (${fmt(quote, 5)})`;
    case 5: return price < quote ? null : `A ${label} must sit below the ${side} (${fmt(quote, 5)})`;
    default: return null;
  }
}

export function EditOrderPanel({ open, orders, onClose }: EditOrderPanelProps) {
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset the form during render when the panel closes.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setPrice(''); setSl(''); setTp(''); setSubmitting(false); }
  }

  const first = orders[0];
  const many = orders.length > 1;
  const newPrice = parse(price);
  const priceValid = newPrice === null || (Number.isFinite(newPrice) && newPrice > 0);
  const sideError = first && newPrice !== null && priceValid ? wrongSide(first, newPrice) : null;
  const quote = first ? fillQuote(first) : null;
  const newDistance = first && newPrice !== null && priceValid ? orderDistancePips({ ...first, openPrice: newPrice }) : null;
  const canSubmit = !submitting && (price || sl || tp) && priceValid && !sideError;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await sendCommands(orders.map(p =>
        modifyCommand(p, sl ? parseFloat(sl) : p.sl, tp ? parseFloat(tp) : p.tp, newPrice ?? undefined)
      ));
      addToast(`Modify sent for ${orders.length} order${many ? 's' : ''}`, 'info');
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
          <div className={styles.title}>{many ? `Edit ${orders.length} orders` : `Edit order · ${first?.ticket ?? ''}`}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          <OrderList orders={orders} />
          <p className={styles.hint}>Leave a field empty to keep {many ? "each order's" : 'the'} current value.</p>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Price</label>
              <input
                type="number"
                className={styles.input}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={many ? 'keep' : first ? fmt(first.openPrice, 5) : ''}
                step="0.00001"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>SL</label>
              <input
                type="number"
                className={styles.input}
                value={sl}
                onChange={e => setSl(e.target.value)}
                placeholder={many ? 'keep' : first ? fmt(first.sl, 5) : '0'}
                step="0.00001"
                inputMode="decimal"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>TP</label>
              <input
                type="number"
                className={styles.input}
                value={tp}
                onChange={e => setTp(e.target.value)}
                placeholder={many ? 'keep' : first ? fmt(first.tp, 5) : '0.00000'}
                step="0.00001"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className={own.stats}>
            <div className={own.stat}>
              <span className={styles.label}>Current price · {first && isBuySide(first.type) ? 'ask' : 'bid'}</span>
              <span className={own.statValue}>{quote !== null ? fmt(quote, 5) : '—'}</span>
            </div>
            <div className={`${own.stat} ${own.statRight}`}>
              <span className={styles.label}>New distance</span>
              <span className={`${own.statValue} ${own.statBig} ${newDistance === null ? own.muted : newDistance >= 0 ? own.profit : own.loss}`}>{fmtDistance(newDistance)}</span>
            </div>
          </div>

          {sideError && <div className={own.error}>{sideError}</div>}

          <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Sending...' : many ? `Modify ${orders.length}` : 'Modify order'}
          </button>
        </div>
      </div>
    </>
  );
}
