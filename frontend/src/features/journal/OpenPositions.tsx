import { useState, useCallback } from 'react';
import { useWs } from '../../lib/useWs';
import { type Position, fmt, fmtPnl, fmtLocalTime, openTimeMs, currencySymbol } from './utils/position';
import { PositionCard } from './PositionCard';
import styles from './JournalPage.module.css';

export function OpenPositions() {
  const [positions, setPositions] = useState<Position[]>([]);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; currency?: string; brokerOffset?: number; positions: Position[] };
    if (msg.type !== 'positions') return;
    const incoming = msg.positions.map(p => ({
      ...p,
      broker: p.broker ?? msg.broker,
      currency: p.currency ?? msg.currency,
      brokerOffset: p.brokerOffset ?? msg.brokerOffset,
    }));
    setPositions(prev => {
      const withoutBroker = prev.filter(p => p.broker !== msg.broker);
      return [...withoutBroker, ...incoming].sort((a, b) =>
        (a.broker ?? '').localeCompare(b.broker ?? '') || openTimeMs(a.openTime) - openTimeMs(b.openTime)
      );
    });
  }, []);

  useWs(handleWsMessage);

  const handleEdit = (p: Position) => {
    console.log('[positions] edit', p.broker, p.ticket);
  };

  const handleClose = (p: Position) => {
    console.log('[positions] close', p.broker, p.ticket);
  };

  if (positions.length === 0) {
    return <div className={styles.empty}>No open positions</div>;
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Symbol</th>
              <th>Lots</th>
              <th>Open Price</th>
              <th>SL</th>
              <th>TP</th>
              <th>Swap</th>
              <th>Commission</th>
              <th>P&amp;L</th>
              <th>Open Time</th>
              <th className={styles.actionsCell} aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map(p => (
              <tr key={`${p.broker}-${p.ticket}`}>
                <td className={styles.broker}>{p.broker}</td>
                <td className={p.type === 0 ? styles.buy : styles.sell}>{p.symbol}</td>
                <td>{fmt(p.lots, 2)}</td>
                <td>{fmt(p.openPrice, 5)}</td>
                <td>{p.sl ? fmt(p.sl, 5) : '—'}</td>
                <td>{p.tp ? fmt(p.tp, 5) : '—'}</td>
                <td className={p.swap < 0 ? styles.loss : p.swap > 0 ? styles.profit : undefined}>
                  {fmt(p.swap, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}
                </td>
                <td className={p.commission < 0 ? styles.loss : p.commission > 0 ? styles.profit : styles.muted}>
                  {fmt(p.commission, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}
                </td>
                <td className={p.profit >= 0 ? styles.profit : styles.loss}>
                  {fmtPnl(p.profit, p.currency)}
                </td>
                <td>{fmtLocalTime(p.openTime, p.brokerOffset)}</td>
                <td className={styles.actionsCell}>
                  <div className={styles.rowActions}>
                    <div className={styles.rowActionsInner}>
                      <button type="button" className={styles.editBtn} onClick={() => handleEdit(p)}>Edit</button>
                      <button type="button" className={styles.closeBtn} onClick={() => handleClose(p)}>Close</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {positions.map(p => (
          <PositionCard
            key={`${p.broker}-${p.ticket}`}
            position={p}
            onEdit={handleEdit}
            onClose={handleClose}
          />
        ))}
      </div>
    </>
  );
}
