import { useState } from 'react';
import {
  fmtEur, fmtLots, fmtPips, fmtPrice, fmtR, fmtR1, fmtShort, resultLabel, resultTone,
  type BookScheme, type BookTrade,
} from '../../lib/book';
import styles from './SchemesTable.module.css';

interface SchemesTableProps {
  schemes: BookScheme[];
  onEditScheme: (scheme: BookScheme) => void;
  onDeleteScheme: (scheme: BookScheme) => void;
  onNewTrade: (scheme: BookScheme) => void;
  onEditTrade: (scheme: BookScheme, trade: BookTrade) => void;
  onDeleteTrade: (scheme: BookScheme, trade: BookTrade) => void;
}

const TONE_CLASS = { green: styles.green, red: styles.red, gold: styles.gold, muted: styles.muted } as const;
const CARD_CLASS = { green: styles.cardGreen, red: styles.cardRed, gold: styles.cardGold, muted: '' } as const;

const signClass = (v: number | null): string => (v === null ? styles.muted : v >= 0 ? styles.green : styles.red);

export function SchemesTable({ schemes, onEditScheme, onDeleteScheme, onNewTrade, onEditTrade, onDeleteTrade }: SchemesTableProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const toggle = (id: number) => setOpenId(current => (current === id ? null : id));

  const trades = (s: BookScheme) => (
    <div className={styles.ops}>
      <div className={styles.opsHead}>
        <span className={styles.opsTitle}>Operaciones del esquema {s.number}{s.open > 0 ? ` · ${s.open} en curso` : ''}</span>
        <button type="button" className={styles.newTradeBtn} onClick={() => onNewTrade(s)}>Nueva operación</button>
      </div>
      {s.trades.length === 0 ? (
        <span className={styles.dim}>Sin operaciones todavía.</span>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={`${styles.table} ${styles.opsTable}`}>
            <thead>
              <tr>
                <th>Ticket</th><th>Pos.</th><th>Dir.</th><th className={styles.num}>Lotes</th><th className={styles.num}>Entrada</th><th className={styles.num}>SL</th>
                <th>Apertura</th><th>Cierre</th><th className={styles.num}>Precio</th><th className={styles.num}>Pips</th><th className={styles.num}>€</th><th className={styles.num}>R</th><th className={styles.num}>Saldo</th><th>Nota</th><th></th>
              </tr>
            </thead>
            <tbody>
              {s.trades.map(t => (
                <tr key={t.id}>
                  <td className={styles.dim}>{t.ticket}</td>
                  <td className={styles.number}>{t.slot}</td>
                  <td className={t.direction === 'buy' ? styles.green : styles.red}>{t.direction}</td>
                  <td className={styles.num}>{fmtLots(t.lots)}</td>
                  <td className={styles.num}>{fmtPrice(t.entry)}</td>
                  <td className={styles.num}>{fmtPrice(t.sl)}</td>
                  <td>{fmtShort(t.openTime)}</td>
                  <td>{t.closeTime ? fmtShort(t.closeTime) : <span className={styles.gold}>en curso</span>}</td>
                  <td className={styles.num}>{fmtPrice(t.closePrice)}</td>
                  <td className={`${styles.num} ${signClass(t.pips)}`}>{fmtPips(t.pips)}</td>
                  <td className={`${styles.num} ${signClass(t.profit)}`}>{fmtEur(t.profit)}</td>
                  <td className={`${styles.num} ${signClass(t.r)}`}>{fmtR(t.r)}</td>
                  <td className={`${styles.num} ${styles.dim}`}>{fmtEur(t.balanceAfter)}</td>
                  <td className={styles.note}>{t.note ?? ''}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.ghostBtn} onClick={() => onEditTrade(s, t)}>Editar</button>
                      <button type="button" className={`${styles.ghostBtn} ${styles.ghostDanger}`} onClick={() => onDeleteTrade(s, t)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th><th>Esq.</th><th>Inicio</th><th>Fin</th><th>Trades</th><th>Tickets</th><th>Resultado</th>
              <th className={styles.num}>Neto €</th><th className={styles.num}>Neto R</th><th></th>
            </tr>
          </thead>
          <tbody>
            {schemes.map(s => {
              const open = openId === s.id;
              return [
                <tr key={s.id} className={`${styles.row} ${open ? styles.rowOpen : ''}`} onClick={() => toggle(s.id)}>
                  <td className={styles.chevron}>{open ? '▾' : '▸'}</td>
                  <td className={styles.number}>{s.number}</td>
                  <td>{s.start}</td>
                  <td>{s.end ?? <span className={styles.gold}>en curso</span>}</td>
                  <td>{s.tradesLine || <span className={styles.dim}>—</span>}</td>
                  <td className={styles.dim}>{s.tickets}</td>
                  <td><span className={`${styles.badge} ${TONE_CLASS[resultTone(s.result)]}`}>{resultLabel(s.result)}</span></td>
                  <td className={`${styles.num} ${signClass(s.netEur)}`}>{fmtEur(s.netEur)}</td>
                  <td className={`${styles.num} ${signClass(s.netR)}`}>{fmtR(s.netR)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button type="button" className={styles.ghostBtn} onClick={() => onEditScheme(s)}>Editar</button>
                      <button type="button" className={`${styles.ghostBtn} ${styles.ghostDanger}`} onClick={() => onDeleteScheme(s)}>Eliminar</button>
                    </div>
                  </td>
                </tr>,
                open ? <tr key={`${s.id}-ops`}><td colSpan={10} className={styles.opsCell}>{trades(s)}</td></tr> : null,
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {schemes.map(s => {
          const open = openId === s.id;
          return (
            <article key={s.id} className={`${styles.card} ${CARD_CLASS[resultTone(s.result)]}`}>
              <button type="button" className={styles.cardHead} onClick={() => toggle(s.id)} aria-expanded={open}>
                <span className={styles.number}>#{s.number}</span>
                <span className={`${styles.badge} ${TONE_CLASS[resultTone(s.result)]}`}>{resultLabel(s.result)}</span>
              </button>
              <div className={`${styles.cardLine} ${styles.dim}`}><span>{s.start} → {s.end ?? 'en curso'}</span><span>{s.tickets}</span></div>
              <div className={styles.cardLine}><span>{s.tradesLine || '—'}</span><span className={signClass(s.netR)}>{fmtEur(s.netEur)} · {fmtR(s.netR)}</span></div>
              {open && (
                <div className={styles.cardOps}>
                  {s.trades.map(t => (
                    <div key={t.id} className={styles.cardOp}>
                      <span className={styles.number}>{t.slot} <span className={t.direction === 'buy' ? styles.green : styles.red}>{t.direction}</span></span>
                      <span className={styles.dim}>{t.ticket} · {fmtLots(t.lots)} l · {fmtPrice(t.entry)} → {t.closePrice === null ? 'en curso' : fmtPrice(t.closePrice)}</span>
                      <span className={signClass(t.r)}>{t.r === null ? '…' : fmtR1(t.r)}R</span>
                    </div>
                  ))}
                  <div className={styles.actions}>
                    <button type="button" className={styles.newTradeBtn} onClick={() => onNewTrade(s)}>Nueva operación</button>
                    <button type="button" className={styles.ghostBtn} onClick={() => onEditScheme(s)}>Editar</button>
                    <button type="button" className={`${styles.ghostBtn} ${styles.ghostDanger}`} onClick={() => onDeleteScheme(s)}>Eliminar</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
