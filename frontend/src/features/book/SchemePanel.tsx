import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../lib/api';
import { RESULTS, resultLabel, type BookScheme, type SchemeInput, type StoredResult } from '../../lib/book';
import { addToast } from '../../lib/toast';
import { IsoDateField } from '../../shared/ui/DateField';
import styles from './panels.module.css';

interface SchemePanelProps {
  open: boolean;
  scheme: BookScheme | null;   // null → create
  nonce: number;               // changes on every open, so the form restarts
  nextNumber: number;
  onSave: (input: SchemeInput, id: number | null) => Promise<unknown>;
  onClose: () => void;
}

interface Fields {
  number: string;
  start: string;
  end: string;
  result: StoredResult;
  note: string;
}

const fieldsOf = (scheme: BookScheme | null, nextNumber: number): Fields => ({
  number: String(scheme?.number ?? nextNumber),
  start: scheme?.start ?? new Date().toISOString().slice(0, 10),
  end: scheme?.end ?? '',
  result: scheme?.storedResult ?? 'auto',
  note: scheme?.note ?? '',
});

export function SchemePanel({ open, scheme, nonce, nextNumber, onSave, onClose }: SchemePanelProps) {
  // The form follows the scheme shown; a different one (or none) resets it.
  const key = `${nonce}:${scheme ? scheme.id : 'new'}`;
  const [synced, setSynced] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(scheme, nextNumber));
  const [busy, setBusy] = useState(false);
  if (open && synced !== key) {
    setSynced(key);
    setFields(fieldsOf(scheme, nextNumber));
  }

  const set = (k: keyof Fields) => (v: string) => setFields(f => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const number = Number(fields.number);
    if (!Number.isInteger(number) || number < 1) { addToast('El número debe ser un entero positivo', 'error'); return; }
    if (!fields.start) { addToast('La fecha de inicio es obligatoria', 'error'); return; }
    setBusy(true);
    try {
      await onSave({ number, start: fields.start, end: fields.end || null, result: fields.result, note: fields.note.trim() || null }, scheme?.id ?? null);
      addToast(scheme ? `Esquema ${number} guardado` : `Esquema ${number} creado`, 'success');
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
          <span className={styles.title}>{scheme ? `Editar esquema · ${scheme.number}` : 'Nuevo esquema'}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form className={styles.form} onSubmit={submit} id="scheme-form">
          <div className={styles.grid}>
            <label className={styles.field}><span className={styles.label}>Número</span><input className={styles.input} type="number" inputMode="numeric" min={1} value={fields.number} onChange={e => set('number')(e.target.value)} required /></label>
            <label className={styles.field}>
              <span className={styles.label}>Resultado</span>
              <select className={styles.select} value={fields.result} onChange={e => set('result')(e.target.value)}>
                <option value="auto">Automático (según operaciones)</option>
                {RESULTS.map(r => <option key={r} value={r}>{resultLabel(r)}</option>)}
              </select>
            </label>
            <div className={styles.field}><label className={styles.label} htmlFor="scheme-start">Inicio</label><IsoDateField id="scheme-start" className={styles.input} value={fields.start} onChange={set('start')} required /></div>
            <div className={styles.field}><label className={styles.label} htmlFor="scheme-end">Fin <em className={styles.hint}>vacío = en curso</em></label><IsoDateField id="scheme-end" className={styles.input} value={fields.end} onChange={set('end')} /></div>
          </div>
          <label className={styles.field}><span className={styles.label}>Nota</span><input className={styles.input} type="text" value={fields.note} onChange={e => set('note')(e.target.value)} maxLength={500} placeholder="opcional" /></label>
          <p className={styles.help}>
            {scheme
              ? `Trades, tickets, neto € y neto R salen de sus ${scheme.trades.length} operaciones. En Automático, el resultado se muestra Pendiente mientras no tenga fin${scheme.open ? ' o tenga una operación en curso' : ''}; con fin, gana la posición que llega a su objetivo, Pierde si todas pierden, Empate con R neta entre −0,5 y +0,5.`
              : 'El esquema aparece arriba de la tabla, vacío, con "Nueva operación" para ir añadiendo T1, T2… En Automático se muestra Pendiente hasta que le pongas fin; un resultado a mano solo para las excepciones.'}
          </p>
        </form>
        <div className={styles.actions}>
          <button type="submit" form="scheme-form" className={styles.primaryBtn} disabled={busy}>{busy ? 'Guardando…' : scheme ? 'Guardar' : 'Crear esquema'}</button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
        </div>
      </aside>
    </>
  );
}
