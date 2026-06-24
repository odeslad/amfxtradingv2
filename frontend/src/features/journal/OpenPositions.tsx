import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../../lib/useWs';
import { apiUrl } from '../../lib/api';
import { type Position, fmt, fmtPnlMode, calcPnl, currentQuote, fmtLocalTime, openTimeMs, currencySymbol, TYPE_LABEL, isPending, isBuySide } from './utils/position';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useBalances } from '../../lib/useBalances';
import { type FilterValues, type FilterOptions } from './FiltersPanel';
import { PositionCard } from './PositionCard';
import { ColorBadge } from './ColorBadge';
import { ConfirmPanel } from './ConfirmPanel';
import { BulkEditPanel } from './BulkEditPanel';
import styles from './JournalPage.module.css';

interface LiveBrokerPositions {
  broker: string;
  currency: string;
  brokerOffset: number;
  positions: Position[];
}

export interface BulkGroup {
  symbol: string;
  type: number;
  positions: Position[];
}

interface OpenPositionsProps {
  filters: FilterValues;
  onOptionsChange: (options: FilterOptions) => void;
  onBulkChange: (group: BulkGroup | null) => void;
}

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function posKey(broker: string, ticket: number) { return `${broker}:${ticket}`; }

export function OpenPositions({ filters, onOptionsChange, onBulkChange }: OpenPositionsProps) {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [colors, setColors] = useState<Map<string, string>>(new Map());
  const [confirmClose, setConfirmClose] = useState<Position | null>(null);
  const [closing, setClosing] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const { pnlMode } = useDisplaySettings();
  const balances = useBalances();

  const handleColorChange = (broker: string, ticket: number, color: string) => {
    setColors(prev => {
      const next = new Map(prev);
      if (color) next.set(posKey(broker, ticket), color);
      else next.delete(posKey(broker, ticket));
      return next;
    });
  };

  useEffect(() => {
    fetch(apiUrl('/positions/live'), { credentials: 'include' })
      .then(res => res.ok ? res.json() as Promise<LiveBrokerPositions[]> : Promise.resolve([]))
      .then((brokers) => {
        const colorMap = new Map<string, string>();
        const all = brokers.flatMap(({ broker, currency, brokerOffset, positions: ps }) =>
          ps.map(p => {
            const pos = { ...p, broker: p.broker ?? broker, currency: p.currency ?? currency, brokerOffset: p.brokerOffset ?? brokerOffset };
            if (pos.color) colorMap.set(posKey(pos.broker!, pos.ticket), pos.color);
            return pos;
          })
        );
        if (colorMap.size > 0) setColors(colorMap);
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
    const activeColors = [...new Set([...colors.values()].filter(Boolean))];
    onOptionsChange({ brokers, symbols, colors: activeColors });
  }, [positions, colors, onOptionsChange]);

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
    // Clean up colors for closed positions of this broker
    const activeTickets = new Set(incoming.map(p => posKey(p.broker!, p.ticket)));
    setColors(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const key of next.keys()) {
        if (key.startsWith(`${msg.broker}:`) && !activeTickets.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useWs(handleWsMessage);

  const handleOpenChart = useCallback((p: Position) => {
    const params = new URLSearchParams({ broker: p.broker ?? '', symbol: p.symbol, timeframe: 'H1' });
    navigate(`/chart?${params.toString()}`);
  }, [navigate]);

  const handleEdit = (p: Position) => setEditPosition(p);

  const handleClose = (p: Position) => setConfirmClose(p);

  const confirmAndClose = async () => {
    if (!confirmClose) return;
    setClosing(true);
    try {
      await fetch(apiUrl('/commands'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: generateId(),
          action: 'close',
          broker: confirmClose.broker,
          symbol: confirmClose.symbol,
          lots: confirmClose.lots,
          ticket: confirmClose.ticket,
          sl: 0,
          tp: 0,
        }),
      });
    } finally {
      setClosing(false);
      setConfirmClose(null);
    }
  };

  const filtered = useMemo(() => positions.filter(p => {
    if (filters.broker && p.broker !== filters.broker) return false;
    if (filters.symbol && p.symbol !== filters.symbol) return false;
    if (filters.type === 'buy' && !isBuySide(p.type)) return false;
    if (filters.type === 'sell' && isBuySide(p.type)) return false;
    if (filters.color && colors.get(posKey(p.broker!, p.ticket)) !== filters.color) return false;
    return true;
  }), [positions, filters, colors]);

  const openPositions = useMemo(() => filtered.filter(p => !isPending(p.type)), [filtered]);
  const pendingOrders = useMemo(() => filtered.filter(p => isPending(p.type)), [filtered]);

  // bulk close applies only to open market positions, never to pending orders
  const bulkGroup = useMemo(() => {
    if (openPositions.length < 1) return null;
    const symbol = openPositions[0].symbol;
    const type = openPositions[0].type;
    return openPositions.every(p => p.symbol === symbol && p.type === type)
      ? { symbol, type, positions: openPositions }
      : null;
  }, [openPositions]);

  useEffect(() => {
    onBulkChange(bulkGroup);
  }, [bulkGroup, onBulkChange]);

  if (positions.length === 0) {
    return <div className={styles.empty}>No open positions</div>;
  }

  if (filtered.length === 0) {
    return <div className={styles.empty}>No positions match the selected filters</div>;
  }

  return (
    <>
      {openPositions.length > 0 && (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Symbol</th>
              <th>Lots</th>
              <th>Open Price</th>
              <th>Price</th>
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
            {openPositions.map(p => (
              <tr key={`${p.broker}-${p.ticket}`} onDoubleClick={() => handleOpenChart(p)} style={{ cursor: 'pointer' }}>
                <td className={styles.broker}>{p.broker}</td>
                <td>
                  <span className={styles.symbolCell}>
                    <ColorBadge
                      broker={p.broker!}
                      ticket={p.ticket}
                      color={colors.get(posKey(p.broker!, p.ticket))}
                      onColorChange={handleColorChange}
                    />
                    <span className={p.type === 0 ? styles.buy : styles.sell}>{p.symbol}</span>
                  </span>
                </td>
                <td>{fmt(p.lots, 2)}</td>
                <td>{fmt(p.openPrice, 5)}</td>
                <td>{currentQuote(p) != null ? fmt(currentQuote(p)!, 5) : '—'}</td>
                <td>{p.sl ? fmt(p.sl, 5) : '—'}</td>
                <td>{p.tp ? fmt(p.tp, 5) : '—'}</td>
                <td className={p.swap < 0 ? styles.loss : p.swap > 0 ? styles.profit : undefined}>
                  {fmt(p.swap, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}
                </td>
                <td className={p.commission < 0 ? styles.loss : p.commission > 0 ? styles.profit : styles.muted}>
                  {fmt(p.commission, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}
                </td>
                <td className={calcPnl(p, pnlMode, balances[p.broker ?? '']) >= 0 ? styles.profit : styles.loss}>
                  {fmtPnlMode(p, pnlMode, balances[p.broker ?? ''])}
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
      )}

      <div className={styles.cards}>
        {openPositions.map(p => (
          <PositionCard
            key={`${p.broker}-${p.ticket}`}
            position={p}
            pnlMode={pnlMode}
            balance={balances[p.broker ?? '']}
            color={colors.get(posKey(p.broker!, p.ticket))}
            onColorChange={handleColorChange}
            onEdit={handleEdit}
            onClose={handleClose}
            onOpenChart={handleOpenChart}
          />
        ))}
      </div>

      {pendingOrders.length > 0 && (
        <div className={styles.pendingSection}>
          <div className={styles.pendingHeader}>Pending Orders</div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Lots</th>
                  <th>Price</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Placed</th>
                  <th className={styles.actionsCell} aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(p => (
                  <tr key={`${p.broker}-${p.ticket}`} onDoubleClick={() => handleOpenChart(p)} style={{ cursor: 'pointer' }}>
                    <td className={styles.broker}>{p.broker}</td>
                    <td><span className={isBuySide(p.type) ? styles.buy : styles.sell}>{p.symbol}</span></td>
                    <td className={isBuySide(p.type) ? styles.buy : styles.sell}>{TYPE_LABEL[p.type]}</td>
                    <td>{fmt(p.lots, 2)}</td>
                    <td>{fmt(p.openPrice, 5)}</td>
                    <td>{p.sl ? fmt(p.sl, 5) : '—'}</td>
                    <td>{p.tp ? fmt(p.tp, 5) : '—'}</td>
                    <td>{fmtLocalTime(p.openTime, p.brokerOffset)}</td>
                    <td className={styles.actionsCell}>
                      <div className={styles.rowActions}>
                        <div className={styles.rowActionsInner}>
                          <button type="button" className={styles.editBtn} onClick={() => handleEdit(p)}>Edit</button>
                          <button type="button" className={styles.closeBtn} onClick={() => handleClose(p)}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {pendingOrders.map(p => (
              <div key={`${p.broker}-${p.ticket}`} className={styles.pendingCard}>
                <div className={styles.pendingCardTop}>
                  <span className={isBuySide(p.type) ? styles.buy : styles.sell}>{p.symbol}</span>
                  <span className={styles.pendingType}>{TYPE_LABEL[p.type]}</span>
                </div>
                <div className={styles.pendingCardRow}><span className={styles.label}>Broker</span><span>{p.broker}</span></div>
                <div className={styles.pendingCardRow}><span className={styles.label}>Price</span><span>{fmt(p.openPrice, 5)}</span></div>
                <div className={styles.pendingCardRow}><span className={styles.label}>Lots</span><span>{fmt(p.lots, 2)}</span></div>
                <div className={styles.pendingCardRow}><span className={styles.label}>SL</span><span>{p.sl ? fmt(p.sl, 5) : '—'}</span></div>
                <div className={styles.pendingCardRow}><span className={styles.label}>TP</span><span>{p.tp ? fmt(p.tp, 5) : '—'}</span></div>
                <div className={styles.pendingCardActions}>
                  <button type="button" className={styles.editBtn} onClick={() => handleEdit(p)}>Edit</button>
                  <button type="button" className={styles.closeBtn} onClick={() => handleClose(p)}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BulkEditPanel
        open={!!editPosition}
        positions={editPosition ? [editPosition] : []}
        onClose={() => setEditPosition(null)}
      />

      <ConfirmPanel
        open={!!confirmClose}
        title={confirmClose && isPending(confirmClose.type) ? 'Cancel order?' : 'Close position?'}
        description={confirmClose ? `${TYPE_LABEL[confirmClose.type]} ${confirmClose.symbol} — ${fmt(confirmClose.lots, 2)} lots` : ''}
        detail={confirmClose?.broker}
        confirmLabel={confirmClose && isPending(confirmClose.type) ? 'Cancel order' : 'Close'}
        confirming={closing}
        onConfirm={confirmAndClose}
        onClose={() => setConfirmClose(null)}
      />
    </>
  );
}
