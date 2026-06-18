import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import styles from './JournalPage.module.css';

interface Position {
  ticket: number;
  broker: string;
  symbol: string;
  type: number;
  lots: number;
  openPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
}

const TYPE_LABEL: Record<number, string> = { 0: 'Buy', 1: 'Sell' };

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtPnl(n: number): string {
  return (n >= 0 ? '+' : '') + fmt(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

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
    const msg = data as { type: string; broker: string; positions: Position[] };
    if (msg.type !== 'positions') return;
    const incoming = msg.positions.map(p => ({ ...p, broker: p.broker ?? msg.broker }));
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
                <tr key={p.ticket}>
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
                    {fmtPnl(p.profit)}
                  </td>
                  <td className={styles.muted}>{fmtDate(p.openTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
