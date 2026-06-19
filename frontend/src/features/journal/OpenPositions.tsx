import { useState, useCallback, useEffect } from 'react';
import { useWs } from '../../lib/useWs';
import { apiUrl } from '../../lib/api';
import { type Position, fmt, fmtPnlMode, calcPnl, fmtLocalTime, openTimeMs, currencySymbol } from './utils/position';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { type FilterValues, type FilterOptions } from './Filters';
import { PositionCard } from './PositionCard';
import styles from './JournalPage.module.css';

interface LiveBrokerPositions {
  broker: string;
  currency: string;
  brokerOffset: number;
  positions: Position[];
}

interface OpenPositionsProps {
  filters: FilterValues;
  onOptionsChange: (options: FilterOptions) => void;
}

export function OpenPositions({ filters, onOptionsChange }: OpenPositionsProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const { pnlMode } = useDisplaySettings();

  useEffect(() => {
    fetch(apiUrl('/positions/live'), { credentials: 'include' })
      .then(res => res.ok ? res.json() as Promise<LiveBrokerPositions[]> : Promise.resolve([]))
      .then((brokers) => {
        const all = brokers.flatMap(({ broker, currency, brokerOffset, positions: ps }) =>
          ps.map(p => ({ ...p, broker: p.broker ?? broker, currency: p.currency ?? currency, brokerOffset: p.brokerOffset ?? brokerOffset }))
        );
        if (all.length > 0) {
          setPositions(all.sort((a, b) =>
            (a.broker ?? '').localeCompare(b.broker ?? '') || openTimeMs(a.openTime) - openTimeMs(b.openTime)
          ));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const brokers = [...new Set(positions.map(p => p.broker ?? '').filter(Boolean))].sort();
    const symbols = [...new Set(positions.map(p => p.symbol).filter(Boolean))].sort();
    onOptionsChange({ brokers, symbols });
  }, [positions, onOptionsChange]);

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

  const filtered = positions.filter(p => {
    if (filters.broker && p.broker !== filters.broker) return false;
    if (filters.symbol && p.symbol !== filters.symbol) return false;
    if (filters.type === 'buy' && p.type !== 0) return false;
    if (filters.type === 'sell' && p.type !== 1) return false;
    return true;
  });

  if (positions.length === 0) {
    return <div className={styles.empty}>No open positions</div>;
  }

  if (filtered.length === 0) {
    return <div className={styles.empty}>No positions match the selected filters</div>;
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
            {filtered.map(p => (
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
                <td className={calcPnl(p, pnlMode) >= 0 ? styles.profit : styles.loss}>
                  {fmtPnlMode(p, pnlMode)}
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
        {filtered.map(p => (
          <PositionCard
            key={`${p.broker}-${p.ticket}`}
            position={p}
            pnlMode={pnlMode}
            onEdit={handleEdit}
            onClose={handleClose}
          />
        ))}
      </div>
    </>
  );
}
