import { useCallback } from 'react';
import { fmtEur, fmtR, PAGE_SIZES, type PageSize } from '../../lib/book';
import { addToast } from '../../lib/toast';
import { SchemesTable } from './SchemesTable';
import { useBook } from './useBook';
import styles from './BookPage.module.css';

export function BookPage() {
  const { data, loading, error, year, page, pageSize, selectYear, setPage, selectPageSize } = useBook();

  // Create / edit / delete arrive with the panels of the next task.
  const notYet = useCallback(() => addToast('Alta y edición llegan en la siguiente tarea', 'info'), []);

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error || !data) return <div className={styles.empty}>{error ?? 'No data'}</div>;

  const { totals } = data;
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  const from = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, data.total);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Schemas</h1>
        <div className={styles.topBarRight}>
          <label htmlFor="book-year" className={styles.label}>Año</label>
          <select id="book-year" className={styles.select} value={String(year ?? 'all')} onChange={e => selectYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            {data.years.map(y => <option key={y} value={y}>{y}</option>)}
            <option value="all">Todos</option>
          </select>
          <button type="button" className={styles.newBtn} onClick={notYet}>Nuevo esquema</button>
        </div>
      </div>

      <section aria-label="Totales" className={styles.totals}>
        <div className={styles.tile}><span className={styles.tileLabel}>Esquemas</span><span className={styles.tileValue}>{totals.schemes}{totals.pending > 0 && <span className={styles.muted}> · {totals.pending} en curso</span>}</span></div>
        <div className={`${styles.tile} ${styles.tileGreen}`}><span className={styles.tileLabel}>Ganados</span><span className={`${styles.tileValue} ${styles.green}`}>{totals.won}</span></div>
        <div className={`${styles.tile} ${styles.tileGold}`}><span className={styles.tileLabel}>Empates</span><span className={styles.tileValue}>{totals.draws}</span></div>
        <div className={`${styles.tile} ${styles.tileRed}`}><span className={styles.tileLabel}>Perdidos</span><span className={`${styles.tileValue} ${styles.red}`}>{totals.lost}</span></div>
        <div className={styles.tile}><span className={styles.tileLabel}>% ganados</span><span className={styles.tileValue}>{totals.winPct} %</span></div>
        <div className={`${styles.tile} ${totals.netEur >= 0 ? styles.tileGreen : styles.tileRed}`}><span className={styles.tileLabel}>Neto €</span><span className={`${styles.tileValue} ${totals.netEur >= 0 ? styles.green : styles.red}`}>{fmtEur(totals.netEur)}</span></div>
        <div className={`${styles.tile} ${totals.netR >= 0 ? styles.tileGreen : styles.tileRed}`}><span className={styles.tileLabel}>Neto R</span><span className={`${styles.tileValue} ${totals.netR >= 0 ? styles.green : styles.red}`}>{fmtR(totals.netR)}</span></div>
      </section>

      {data.schemes.length === 0 ? (
        <div className={styles.empty}>Ningún esquema en esta selección.</div>
      ) : (
        <SchemesTable
          schemes={data.schemes}
          onEditScheme={notYet}
          onDeleteScheme={notYet}
          onNewTrade={notYet}
          onEditTrade={notYet}
          onDeleteTrade={notYet}
        />
      )}

      <nav aria-label="Paginación" className={styles.pagination}>
        <span className={styles.range}>Esquemas {from}–{to} de {data.total} · del más nuevo al más antiguo</span>
        <div className={styles.paginationRight}>
          <label htmlFor="book-page-size" className={styles.label}>Por página</label>
          <select id="book-page-size" className={styles.select} value={pageSize} onChange={e => selectPageSize(Number(e.target.value) as PageSize)}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Anterior</button>
          <span className={styles.pageNo}>{page} / {pages}</span>
          <button type="button" className={styles.pageBtn} disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente ›</button>
        </div>
      </nav>
    </div>
  );
}
