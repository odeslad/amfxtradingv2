import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, isAbortError } from '../../lib/api';
import {
  fmtEur, fmtLots, fmtPips, fmtR, parseBookInput, previewTrade, SLOTS, toBookInput,
  type BookScheme, type BookTrade, type Direction, type Slot, type TradeInput, type TradePreview,
} from '../../lib/book';
import { addToast } from '../../lib/toast';
import { DateField } from '../../shared/ui/DateField';
import styles from './panels.module.css';

interface TradePanelProps {
  open: boolean;
  scheme: BookScheme | null;
  trade: BookTrade | null;      // null → create
  nonce: number;                // changes on every open, so the form restarts
  onSave: (input: TradeInput, id: number | null) => Promise<unknown>;
  onClose: () => void;
}

interface Fields {
  slot: Slot;
  direction: Direction;
  entry: string;
  sl: string;
  openTime: string;
  closeTime: string;
  closePrice: string;
  lots: string;       // '' → proposed
  note: string;
}

const nextSlot = (scheme: BookScheme | null): Slot => {
  const n = scheme?.trades.length ?? 0;
  return n === 0 ? 'T1' : n === 1 ? 'T2' : 'T3';
};

const fieldsOf = (scheme: BookScheme | null, trade: BookTrade | null): Fields => ({
  slot: trade?.slot ?? nextSlot(scheme),
  direction: trade?.direction ?? 'buy',
  entry: trade ? String(trade.entry) : '',
  sl: trade ? String(trade.sl) : '',
  openTime: trade ? toBookInput(trade.openTime) : '',
  closeTime: trade ? toBookInput(trade.closeTime) : '',
  closePrice: trade?.closePrice !== null && trade?.closePrice !== undefined ? String(trade.closePrice) : '',
  lots: trade ? String(trade.lots) : '',
  note: trade?.note ?? '',
});

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export function TradePanel({ open, scheme, trade, nonce, onSave, onClose }: TradePanelProps) {
  const key = `${nonce}:${scheme?.id ?? 'none'}:${trade?.id ?? 'new'}`;
  const [synced, setSynced] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(scheme, trade));
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (open && synced !== key) {
    setSynced(key);
    setFields(fieldsOf(scheme, trade));
    setPreview(null);
    setPreviewError(null);
  }

  const set = (k: keyof Fields) => (v: string) => setFields(f => ({ ...f, [k]: v }));

  const entry = num(fields.entry);
  const sl = num(fields.sl);
  const closePrice = num(fields.closePrice);
  const lots = num(fields.lots);
  const ready = entry !== null && sl !== null && entry > 0 && sl > 0 && entry !== sl;
  const openTime = parseBookInput(fields.openTime);
  const closeTime = parseBookInput(fields.closeTime);
  const closed = fields.closeTime.trim() !== '' || closePrice !== null;
  const closeComplete = closeTime !== null && closePrice !== null;

  // Preview after each change, debounced, through the same arithmetic the save uses.
  useEffect(() => {
    if (!open || !ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      previewTrade({
        slot: fields.slot, direction: fields.direction, entry, sl, openTime: openTime ?? new Date().toISOString(),
        closeTime: closeComplete ? closeTime : null, closePrice: closeComplete ? closePrice : null, lots, tradeId: trade?.id,
      }, { signal: controller.signal })
        .then(p => { setPreview(p); setPreviewError(null); })
        .catch(err => { if (!isAbortError(err)) setPreviewError(errorMessage(err)); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, ready, fields.slot, fields.direction, entry, sl, openTime, closeTime, closePrice, closeComplete, lots, trade?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!scheme || !ready) { addToast('Entrada y SL son obligatorios y distintos', 'error'); return; }
    if (openTime === null) { addToast('La apertura es obligatoria, en formato DD/MM/YYYY HH:MM', 'error'); return; }
    if (fields.closeTime.trim() !== '' && closeTime === null) { addToast('El cierre debe ser DD/MM/YYYY HH:MM', 'error'); return; }
    if (closed && !closeComplete) { addToast('Para cerrar la operación hacen falta hora y precio de cierre', 'error'); return; }
    setBusy(true);
    try {
      await onSave({
        schemeId: scheme.id, slot: fields.slot, direction: fields.direction, entry, sl, openTime,
        closeTime: closeComplete ? closeTime : null, closePrice: closeComplete ? closePrice : null,
        lots, note: fields.note.trim() || null,
      }, trade?.id ?? null);
      addToast(trade ? `Operación ${trade.ticket} guardada` : 'Operación creada', 'success');
      onClose();
    } catch (err) {
      addToast(errorMessage(err), 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${styles.panel} ${open ? styles.panelOpen : ''}`} aria-hidden={!open}>
        <div className={styles.header}>
          <span className={styles.title}>{trade ? `Editar operación · ${trade.ticket}` : `Nueva operación · esquema ${scheme?.number ?? ''}`}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form className={styles.form} onSubmit={submit} id="trade-form">
          <div className={styles.grid}>
            <label className={styles.field}><span className={styles.label}>Posición</span>
              <select className={styles.select} value={fields.slot} onChange={e => set('slot')(e.target.value)}>{SLOTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            </label>
            <label className={styles.field}><span className={styles.label}>Dirección</span>
              <select className={styles.select} value={fields.direction} onChange={e => set('direction')(e.target.value)}><option value="buy">buy</option><option value="sell">sell</option></select>
            </label>
            <label className={styles.field}><span className={styles.label}>Entrada</span><input className={styles.input} type="number" step="0.0001" inputMode="decimal" value={fields.entry} onChange={e => set('entry')(e.target.value)} required /></label>
            <label className={styles.field}><span className={styles.label}>SL</span><input className={styles.input} type="number" step="0.0001" inputMode="decimal" value={fields.sl} onChange={e => set('sl')(e.target.value)} required /></label>
            <div className={styles.field}><label className={styles.label} htmlFor="trade-open">Apertura</label><DateField id="trade-open" mode="datetime" className={styles.input} value={fields.openTime} onChange={set('openTime')} required /></div>
            <div className={styles.field}><label className={styles.label} htmlFor="trade-close">Cierre <em className={styles.hint}>vacío = en curso</em></label><DateField id="trade-close" mode="datetime" className={styles.input} value={fields.closeTime} onChange={set('closeTime')} /></div>
            <label className={styles.field}><span className={styles.label}>Precio de cierre</span><input className={styles.input} type="number" step="0.0001" inputMode="decimal" value={fields.closePrice} onChange={e => set('closePrice')(e.target.value)} /></label>
            <label className={styles.field}><span className={styles.label}>Lotes <em className={styles.hint}>vacío = propuesta 1 %</em></span><input className={styles.input} type="number" step="0.01" inputMode="decimal" value={fields.lots} onChange={e => set('lots')(e.target.value)} placeholder={preview ? fmtLots(preview.proposedLots) : ''} /></label>
          </div>
          <label className={styles.field}><span className={styles.label}>Nota</span><input className={styles.input} type="text" value={fields.note} onChange={e => set('note')(e.target.value)} maxLength={500} placeholder="opcional" /></label>
        </form>
        <section className={styles.preview} aria-label="Previsualización">
          <span className={styles.label}>Calculado{preview ? ` · ticket ${preview.ticket} · saldo base ${fmtEur(preview.riskBase)} · riesgo 1 % = ${fmtEur(preview.riskBase * 0.01)}` : ''}</span>
          {previewError ? <span className={styles.error}>{previewError}</span> : null}
          <div className={styles.previewGrid}>
            <div className={styles.previewTile}><span className={styles.label}>Lotes</span><span className={styles.previewValue}>{preview ? fmtLots(preview.lots) : '—'}</span></div>
            <div className={styles.previewTile}><span className={styles.label}>Pips</span><span className={`${styles.previewValue} ${preview?.pips != null ? (preview.pips >= 0 ? styles.green : styles.red) : ''}`}>{preview && preview.pips !== null ? fmtPips(preview.pips) : 'en curso'}</span></div>
            <div className={styles.previewTile}><span className={styles.label}>€</span><span className={`${styles.previewValue} ${preview?.profit != null ? (preview.profit >= 0 ? styles.green : styles.red) : ''}`}>{preview && preview.profit !== null ? fmtEur(preview.profit) : '—'}</span></div>
            <div className={styles.previewTile}><span className={styles.label}>R</span><span className={`${styles.previewValue} ${preview?.r != null ? (preview.r >= 0 ? styles.green : styles.red) : ''}`}>{preview && preview.r !== null ? fmtR(preview.r) : '—'}</span></div>
            <div className={styles.previewTile}><span className={styles.label}>Lotes 1 %</span><span className={styles.previewValue}>{preview ? fmtLots(preview.proposedLots) : '—'}</span></div>
          </div>
          <p className={styles.help}>€ = lotes × pips × 10 · R = pips ganados ÷ pips de entrada al SL. Al guardar se recalcula toda la cadena de saldos.</p>
        </section>
        <div className={styles.actions}>
          <button type="submit" form="trade-form" className={styles.primaryBtn} disabled={busy || !ready}>{busy ? 'Guardando…' : trade ? 'Guardar operación' : 'Crear operación'}</button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
        </div>
      </aside>
    </>
  );
}
