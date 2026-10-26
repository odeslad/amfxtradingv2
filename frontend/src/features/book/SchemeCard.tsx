import { fmtEur, fmtR1, resultLabel, resultTone, type BookScheme, type ResultTone } from '../../lib/book';
import styles from './SchemeCard.module.css';

interface SchemeCardProps {
  scheme: BookScheme;
  open: boolean;
  onToggle: () => void;
  onOpenOperations?: () => void;
  onNewTrade: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const TONE_CLASS: Record<ResultTone, string> = { green: styles.green, red: styles.red, gold: styles.gold, muted: styles.gold };
const BORDER_CLASS: Record<ResultTone, string> = { green: styles.borderGreen, red: styles.borderRed, gold: styles.borderGold, muted: styles.borderGold };

const signClass = (v: number): string => (v >= 0 ? styles.green : styles.red);
const datePart = (text: string): string => text.split(' ')[0] ?? text;

// Phone card of a scheme (spec 026): labelled summary, expanded detail with the
// operations button and the scheme actions.
export function SchemeCard({ scheme: s, open, onToggle, onOpenOperations, onNewTrade, onEdit, onDelete }: SchemeCardProps) {
  const tone = resultTone(s.result);
  const result = s.result === 'Pendiente' ? 'En curso' : resultLabel(s.result);

  return (
    <article className={`${styles.card} ${BORDER_CLASS[tone]} ${open ? styles.cardOpen : ''}`}>
      <button type="button" className={styles.head} onClick={onToggle} aria-expanded={open}>
        <span className={styles.number}>{open ? '▾' : '▸'} #{s.number}</span>
        <span className={`${styles.result} ${TONE_CLASS[tone]}`}>{result}</span>
      </button>

      {open ? (
        <>
          <div className={styles.grid2}>
            <div className={styles.field}><span className={styles.label}>Inicio</span><span className={styles.value}>{s.start}</span></div>
            <div className={`${styles.field} ${styles.right}`}><span className={styles.label}>Fin</span><span className={`${styles.value} ${s.end ? '' : styles.gold}`}>{s.end ?? 'en curso'}</span></div>
            <div className={styles.field}><span className={styles.label}>Neto €</span><span className={`${styles.value} ${styles.mid} ${signClass(s.netEur)}`}>{fmtEur(s.netEur)}</span></div>
            <div className={`${styles.field} ${styles.right}`}><span className={styles.label}>Neto R</span><span className={`${styles.value} ${styles.big} ${signClass(s.netR)}`}>{fmtR1(s.netR)}</span></div>
          </div>

          {onOpenOperations && (
            <button type="button" className={styles.opsBtn} onClick={onOpenOperations}>
              <span className={styles.opsLabel}>Ver operaciones <span className={styles.pill}>{s.trades.length}</span></span>
              <span className={styles.opsRight}>
                {s.open > 0 && <span className={styles.gold}>{s.open} en curso</span>}
                <span className={styles.chevron} aria-hidden="true">›</span>
              </span>
            </button>
          )}

          <div className={styles.actions}>
            <button type="button" className={`${styles.actBtn} ${styles.actNew}`} onClick={onNewTrade}>+ Operación</button>
            <button type="button" className={styles.actBtn} onClick={onEdit}>Editar</button>
            <button type="button" className={`${styles.actBtn} ${styles.actDelete}`} onClick={onDelete}>Eliminar</button>
          </div>
        </>
      ) : (
        <div className={styles.grid3}>
          <div className={styles.field}><span className={styles.label}>Inicio</span><span className={styles.value}>{datePart(s.start)}</span></div>
          <div className={styles.field}><span className={styles.label}>Neto €</span><span className={`${styles.value} ${signClass(s.netEur)}`}>{fmtEur(s.netEur)}</span></div>
          <div className={`${styles.field} ${styles.right}`}><span className={styles.label}>Neto R</span><span className={`${styles.value} ${styles.big} ${signClass(s.netR)}`}>{fmtR1(s.netR)}</span></div>
        </div>
      )}
    </article>
  );
}
