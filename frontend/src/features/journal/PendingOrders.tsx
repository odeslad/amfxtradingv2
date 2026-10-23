import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Position, fmt, fmtDistance, fmtLocalTime, TYPE_LABEL, isBuySide, orderDistancePips } from './utils/position';
import { type FilterOptions } from './FiltersPanel';
import { type OrderFilterValues } from './utils/orderFilters';
import { OrderCard } from './OrderCard';
import { ColorBadge } from './ColorBadge';
import { posKey } from './useLivePositions';
import styles from './JournalPage.module.css';

interface PendingOrdersProps {
  orders: Position[];                   // pending orders only (types 2–5)
  colors: Map<string, string>;
  onColorChange: (broker: string, ticket: number, color: string) => void;
  filters: OrderFilterValues;
  onOptionsChange: (options: FilterOptions) => void;
  onGroupChange: (group: Position[] | null) => void;
  onEdit: (p: Position) => void;
  onCancel: (p: Position) => void;
}

export function PendingOrders({ orders, colors, onColorChange, filters, onOptionsChange, onGroupChange, onEdit, onCancel }: PendingOrdersProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const brokers = [...new Set(orders.map(p => p.broker ?? '').filter(Boolean))].sort();
    const symbols = [...new Set(orders.map(p => p.symbol).filter(Boolean))].sort();
    const activeColors = [...new Set(orders.map(p => colors.get(posKey(p.broker!, p.ticket)) ?? '').filter(Boolean))];
    onOptionsChange({ brokers, symbols, colors: activeColors });
  }, [orders, colors, onOptionsChange]);

  const handleOpenChart = useCallback((p: Position) => {
    const params = new URLSearchParams({ broker: p.broker ?? '', symbol: p.symbol, timeframe: 'H1' });
    navigate(`/chart?${params.toString()}`);
  }, [navigate]);

  const filtered = useMemo(() => orders.filter(p => {
    if (filters.broker && p.broker !== filters.broker) return false;
    if (filters.symbol && p.symbol !== filters.symbol) return false;
    if (filters.orderType && String(p.type) !== filters.orderType) return false;
    if (filters.side === 'buy' && !isBuySide(p.type)) return false;
    if (filters.side === 'sell' && isBuySide(p.type)) return false;
    if (filters.color && colors.get(posKey(p.broker!, p.ticket)) !== filters.color) return false;
    return true;
  }), [orders, filters, colors]);

  // The group actions apply when every listed order shares symbol and type, as in Positions.
  const group = useMemo(() => {
    if (filtered.length < 1) return null;
    const { symbol, type } = filtered[0];
    return filtered.every(p => p.symbol === symbol && p.type === type) ? filtered : null;
  }, [filtered]);

  useEffect(() => {
    onGroupChange(group);
  }, [group, onGroupChange]);

  if (orders.length === 0) {
    return <div className={styles.empty}>No pending orders</div>;
  }

  if (filtered.length === 0) {
    return <div className={styles.empty}>No orders match the selected filters</div>;
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Symbol</th>
              <th>Type</th>
              <th>Lots</th>
              <th>Price</th>
              <th>Distance</th>
              <th>SL</th>
              <th>TP</th>
              <th>Placed</th>
              <th className={styles.actionsCell} aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const distance = orderDistancePips(p);
              return (
                <tr key={`${p.broker}-${p.ticket}`} onDoubleClick={() => handleOpenChart(p)} style={{ cursor: 'pointer' }}>
                  <td className={styles.broker}>{p.broker}</td>
                  <td>
                    <span className={styles.symbolCell}>
                      <ColorBadge
                        broker={p.broker!}
                        ticket={p.ticket}
                        color={colors.get(posKey(p.broker!, p.ticket))}
                        onColorChange={onColorChange}
                      />
                      <span className={isBuySide(p.type) ? styles.buy : styles.sell}>{p.symbol}</span>
                    </span>
                  </td>
                  <td className={isBuySide(p.type) ? styles.buy : styles.sell}>{TYPE_LABEL[p.type]}</td>
                  <td>{fmt(p.lots, 2)}</td>
                  <td>{fmt(p.openPrice, 5)}</td>
                  <td className={distance === null ? styles.muted : distance >= 0 ? styles.profit : styles.loss}>{fmtDistance(distance)}</td>
                  <td>{p.sl ? fmt(p.sl, 5) : '—'}</td>
                  <td>{p.tp ? fmt(p.tp, 5) : '—'}</td>
                  <td>{fmtLocalTime(p.openTime, p.brokerOffset)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.rowActions}>
                      <div className={styles.rowActionsInner}>
                        <button type="button" className={styles.editBtn} onClick={() => onEdit(p)}>Edit</button>
                        <button type="button" className={styles.closeBtn} onClick={() => onCancel(p)}>Cancel</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {filtered.map(p => (
          <OrderCard
            key={`${p.broker}-${p.ticket}`}
            order={p}
            color={colors.get(posKey(p.broker!, p.ticket))}
            onColorChange={onColorChange}
            onEdit={onEdit}
            onCancel={onCancel}
            onOpenChart={handleOpenChart}
          />
        ))}
      </div>
    </>
  );
}
