import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { type Position, TYPE_LABEL, fmt, fmtPnl, fmtDate } from './position';
import { PositionCard } from './PositionCard';
import styles from './JournalPage.module.css';

export function JournalPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl('/positions'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load positions');
        return res.json() as Promise<Position[]>;
      })
      .then(setPositions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; currency?: string; positions: Position[] };
    if (msg.type !== 'positions') return;
    const incoming = msg.positions.map(p => ({
      ...p,
      broker: p.broker ?? msg.broker,
      currency: p.currency ?? msg.currency,
    }));
    setPositions(prev => {
      const withoutBroker = prev.filter(p => p.broker !== msg.broker);
      return [...withoutBroker, ...incoming].sort((a, b) =>
        (a.broker ?? '').localeCompare(b.broker ?? '') || new Date(a.openTime).getTime() - new Date(b.openTime).getTime()
      );
    });
  }, []);

  useWs(handleWsMessage);

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.title}>Open Positions</span>
        <span className={styles.count}>{positions.length} active</span>
      </div>

      {positions.length === 0 ? (
        <div className={styles.empty}>No open positions</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Lots</th>
                  <th>Open Price</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Swap</th>
                  <th>Commission</th>
                  <th>P&amp;L</th>
                  <th>Open Time</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={`${p.broker}-${p.ticket}`}>
                    <td className={styles.broker}>{p.broker}</td>
                    <td>{p.symbol}</td>
                    <td className={p.type === 0 ? styles.buy : styles.sell}>
                      {TYPE_LABEL[p.type] ?? p.type}
                    </td>
                    <td>{fmt(p.lots, 2)}</td>
                    <td>{fmt(p.openPrice, 5)}</td>
                    <td className={styles.muted}>{p.sl ? fmt(p.sl, 5) : '—'}</td>
                    <td className={styles.muted}>{p.tp ? fmt(p.tp, 5) : '—'}</td>
                    <td className={p.swap < 0 ? styles.loss : styles.muted}>{fmt(p.swap, 2)}</td>
                    <td className={p.commission < 0 ? styles.loss : styles.muted}>{fmt(p.commission, 2)}</td>
                    <td className={p.profit >= 0 ? styles.profit : styles.loss}>
                      {fmtPnl(p.profit, p.currency)}
                    </td>
                    <td className={styles.muted}>{fmtDate(p.openTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {positions.map(p => (
              <PositionCard key={`${p.broker}-${p.ticket}`} position={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
