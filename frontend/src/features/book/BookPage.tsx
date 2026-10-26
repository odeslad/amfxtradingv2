import { useCallback, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { fmtEur, fmtR, fmtR1, PAGE_SIZES, type BookScheme, type BookTrade, type PageSize, type SchemeInput, type TradeInput } from '../../lib/book';
import { addToast } from '../../lib/toast';
import { ConfirmPanel } from '../journal/ConfirmPanel';
import { SchemePanel } from './SchemePanel';
import { SchemesTable } from './SchemesTable';
import { TradePanel } from './TradePanel';
import { useBook } from './useBook';
import styles from './BookPage.module.css';

type Panel =
  | { kind: 'scheme'; scheme: BookScheme | null; nonce: number }
  | { kind: 'trade'; scheme: BookScheme; trade: BookTrade | null; nonce: number }
  | { kind: 'deleteScheme'; scheme: BookScheme }
  | { kind: 'deleteTrade'; scheme: BookScheme; trade: BookTrade }
  | null;

export function BookPage() {
  const { data, loading, error, year, page, pageSize, selectYear, setPage, selectPageSize, actions } = useBook();
  const [panel, setPanel] = useState<Panel>(null);
  const [confirming, setConfirming] = useState(false);
  const close = useCallback(() => setPanel(null), []);

  const saveScheme = useCallback((input: SchemeInput, id: number | null) =>
    id === null ? actions.createScheme(input) : actions.updateScheme(id, input), [actions]);
  const saveTrade = useCallback((input: TradeInput, id: number | null) =>
    id === null ? actions.createTrade(input) : actions.updateTrade(id, input), [actions]);

  const confirmDelete = useCallback(async () => {
    if (!panel || (panel.kind !== 'deleteScheme' && panel.kind !== 'deleteTrade')) return;
    setConfirming(true);
    try {
      if (panel.kind === 'deleteScheme') {
        await actions.deleteScheme(panel.scheme.id);
        addToast(`Esquema ${panel.scheme.number} eliminado`, 'success');
      } else {
        await actions.deleteTrade(panel.trade.id);
        addToast(`Operación ${panel.trade.ticket} eliminada`, 'success');
      }
      setPanel(null);
    } catch (err) {
      addToast(errorMessage(err), 'error', 6000);
    } finally {
      setConfirming(false);
    }
  }, [actions, panel]);

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error || !data) return <div className={styles.empty}>{error ?? 'No data'}</div>;

  const { totals } = data;
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  const from = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, data.total);
  const deleting = panel?.kind === 'deleteScheme' || panel?.kind === 'deleteTrade' ? panel : null;
  const activeYear: number | 'all' = typeof year === 'number' ? year : 'all';

  return (
    <div className={styles.page}>
      <div className={styles.tabBar}>
        <div className={styles.tabs} role="tablist" aria-label="Año">
          {data.years.map(y => (
            <button key={y} type="button" role="tab" aria-selected={activeYear === y} className={`${styles.tab} ${activeYear === y ? styles.tabActive : ''}`} onClick={() => selectYear(y)}>{y}</button>
          ))}
          <button type="button" role="tab" aria-selected={activeYear === 'all'} className={`${styles.tab} ${activeYear === 'all' ? styles.tabActive : ''}`} onClick={() => selectYear('all')}>Todos</button>
        </div>
        <div className={styles.tabBarRight}>
          <button type="button" className={styles.newBtn} onClick={() => setPanel({ kind: 'scheme', scheme: null, nonce: Date.now() })}>+ Nuevo esquema</button>
        </div>
      </div>

      <section aria-label="Totales" className={styles.strip}>
        <div className={styles.stat}><span className={styles.statLabel}>Esquemas</span><span className={styles.statValue}>{totals.schemes}{totals.pending > 0 && <span className={styles.pending}> · {totals.pending} en curso</span>}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Ganados</span><span className={`${styles.statValue} ${styles.green}`}>{totals.won}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Empates</span><span className={`${styles.statValue} ${styles.gold}`}>{totals.draws}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Perdidos</span><span className={`${styles.statValue} ${styles.red}`}>{totals.lost}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>% ganados</span><span className={styles.statValue}>{totals.winPct} %</span></div>
        <div className={`${styles.stat} ${styles.statPush}`}><span className={styles.statLabel}>Neto €</span><span className={`${styles.statValue} ${styles.statBig} ${totals.netEur >= 0 ? styles.green : styles.red}`}>{fmtEur(totals.netEur)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Neto R</span><span className={`${styles.statValue} ${styles.statBig} ${totals.netR >= 0 ? styles.green : styles.red}`}>{fmtR(totals.netR)}</span></div>
      </section>

      <section aria-label="Totales" className={styles.totalsMobile}>
        <span className={styles.statLabel}>{totals.schemes} esquemas{totals.pending > 0 && <span className={styles.gold}> · {totals.pending} en curso</span>}</span>
        <div className={styles.mGrid2}>
          <div className={styles.mField}><span className={styles.statLabel}>Neto €</span><span className={`${styles.mNetEur} ${totals.netEur >= 0 ? styles.green : styles.red}`}>{fmtEur(totals.netEur)}</span></div>
          <div className={`${styles.mField} ${styles.mRight}`}><span className={styles.statLabel}>Neto R</span><span className={`${styles.mNetR} ${totals.netR >= 0 ? styles.green : styles.red}`}>{fmtR1(totals.netR)}</span></div>
        </div>
        <div className={styles.mGrid4}>
          <div className={styles.mField}><span className={styles.statLabel}>Ganados</span><span className={`${styles.mCount} ${styles.green}`}>{totals.won}</span></div>
          <div className={styles.mField}><span className={styles.statLabel}>Empates</span><span className={`${styles.mCount} ${styles.gold}`}>{totals.draws}</span></div>
          <div className={styles.mField}><span className={styles.statLabel}>Perdidos</span><span className={`${styles.mCount} ${styles.red}`}>{totals.lost}</span></div>
          <div className={`${styles.mField} ${styles.mRight}`}><span className={styles.statLabel}>% ganados</span><span className={styles.mCount}>{totals.winPct} %</span></div>
        </div>
      </section>

      {data.schemes.length === 0 ? (
        <div className={styles.empty}>Ningún esquema en esta selección.</div>
      ) : (
        <SchemesTable
          schemes={data.schemes}
          onEditScheme={s => setPanel({ kind: 'scheme', scheme: s, nonce: Date.now() })}
          onDeleteScheme={s => setPanel({ kind: 'deleteScheme', scheme: s })}
          onNewTrade={s => setPanel({ kind: 'trade', scheme: s, trade: null, nonce: Date.now() })}
          onEditTrade={(s, t) => setPanel({ kind: 'trade', scheme: s, trade: t, nonce: Date.now() })}
          onDeleteTrade={(s, t) => setPanel({ kind: 'deleteTrade', scheme: s, trade: t })}
        />
      )}

      <nav aria-label="Paginación" className={styles.pagination}>
        <span className={styles.range}>Esquemas {from}–{to} de {data.total} · del más nuevo al más antiguo</span>
        <div className={styles.paginationRight}>
          <label htmlFor="book-page-size" className={styles.label}>Por página</label>
          <select id="book-page-size" className={styles.select} value={pageSize} onChange={e => selectPageSize(Number(e.target.value) as PageSize)}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Anterior">‹</button>
          <span className={styles.pageNo}>{page} / {pages}</span>
          <button type="button" className={styles.pageBtn} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Siguiente">›</button>
        </div>
      </nav>

      <nav aria-label="Paginación" className={styles.paginationMobile}>
        <button type="button" className={styles.pageBtnMobile} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Anterior">‹</button>
        <span className={styles.pageNo}>{page} / {pages} <span className={styles.muted}>· {pageSize} por pág.</span></span>
        <button type="button" className={styles.pageBtnMobile} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Siguiente">›</button>
      </nav>

      <SchemePanel
        open={panel?.kind === 'scheme'}
        scheme={panel?.kind === 'scheme' ? panel.scheme : null}
        nonce={panel?.kind === 'scheme' ? panel.nonce : 0}
        nextNumber={data.nextNumber}
        onSave={saveScheme}
        onClose={close}
      />
      <TradePanel
        open={panel?.kind === 'trade'}
        scheme={panel?.kind === 'trade' ? panel.scheme : null}
        trade={panel?.kind === 'trade' ? panel.trade : null}
        nonce={panel?.kind === 'trade' ? panel.nonce : 0}
        onSave={saveTrade}
        onClose={close}
      />
      <ConfirmPanel
        open={deleting !== null}
        title={deleting?.kind === 'deleteScheme' ? 'Eliminar esquema' : 'Eliminar operación'}
        description={
          deleting?.kind === 'deleteScheme'
            ? `Esquema ${deleting.scheme.number} (${deleting.scheme.start}) con ${deleting.scheme.trades.length} operación${deleting.scheme.trades.length === 1 ? '' : 'es'}.`
            : deleting?.kind === 'deleteTrade'
              ? `Operación ${deleting.trade.ticket} (${deleting.trade.slot} ${deleting.trade.direction}) del esquema ${deleting.scheme.number}.`
              : ''
        }
        detail="Los saldos de las operaciones posteriores se recalculan. No se puede deshacer."
        confirmLabel="Eliminar"
        confirmingLabel="Eliminando…"
        confirming={confirming}
        onConfirm={confirmDelete}
        onClose={close}
      />
    </div>
  );
}
