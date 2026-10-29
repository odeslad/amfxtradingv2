import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../lib/api';
import { closeCommand, sendCommand } from '../../lib/commands';
import { addToast } from '../../lib/toast';
import { type Position, fmt, fmtPnlMode, calcPnl, currentQuote, fmtLocalTime, currencySymbol, TYPE_LABEL, isBuySide, isPending, sameSymbol } from './utils/position';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useBalances } from '../../lib/useBalances';
import { isVisible, useVisibility } from '../../lib/visibility';
import { type FilterValues, type FilterOptions } from './FiltersPanel';
import { PositionCard } from './PositionCard';
import { ColorBadge } from './ColorBadge';
import { ConfirmPanel } from './ConfirmPanel';
import { BulkEditPanel } from './BulkEditPanel';
import { posKey, setLiveColor, useLivePositions } from './useLivePositions';
import styles from './JournalPage.module.css';

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

export function OpenPositions({ filters, onOptionsChange, onBulkChange }: OpenPositionsProps) {
  const navigate = useNavigate();
  // The live feed is subscribed here, not by the page: only this tab renders per update.
  const live = useLivePositions();
  const visibility = useVisibility();
  // Hidden brokers / symbols (spec 024) leave the list here, so the filter options and group never see them.
  const positions = useMemo(
    () => live.positions.filter(p => !isPending(p.type) && isVisible(visibility, p.broker ?? '', p.symbol)),
    [live.positions, visibility],
  );
  const colors = live.colors;
  const onColorChange = setLiveColor;
  const [confirmClose, setConfirmClose] = useState<Position | null>(null);
  const [closing, setClosing] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const { pnlMode } = useDisplaySettings();
  const balances = useBalances();

  // Filter options: reported to the page only when their content changes (spec 019).
  const options = useMemo(() => {
    const brokers = [...new Set(positions.map(p => p.broker ?? '').filter(Boolean))].sort();
    const symbols = [...new Set(positions.map(p => p.symbol).filter(Boolean))].sort();
    const activeColors = [...new Set(positions.map(p => colors.get(posKey(p.broker!, p.ticket)) ?? '').filter(Boolean))];
    return { brokers, symbols, colors: activeColors, key: `${brokers.join(',')}|${symbols.join(',')}|${activeColors.join(',')}` };
  }, [positions, colors]);
  const optionsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (options.key === optionsKeyRef.current) return;
    optionsKeyRef.current = options.key;
    onOptionsChange({ brokers: options.brokers, symbols: options.symbols, colors: options.colors });
  }, [options, onOptionsChange]);

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
      await sendCommand(closeCommand(confirmClose));
    } catch (err) {
      addToast(errorMessage(err, 'Failed to send close command'), 'error');
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

  // The group actions apply when every listed position shares symbol and type.
  const bulkGroup = useMemo(() => {
    if (filtered.length < 1) return null;
    const symbol = filtered[0].symbol;
    const type = filtered[0].type;
    return filtered.every(p => sameSymbol(p.symbol, symbol) && p.type === type)
      ? { symbol, type, positions: filtered }
      : null;
  }, [filtered]);

  // The page's group changes when a ticket enters or leaves, or an SL / TP moves; not when profit does.
  const bulkKey = bulkGroup ? `${bulkGroup.symbol}|${bulkGroup.type}|${bulkGroup.positions.map(p => `${p.ticket}:${p.sl}:${p.tp}`).join(',')}` : '';
  const bulkKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (bulkKey === bulkKeyRef.current) return;
    bulkKeyRef.current = bulkKey;
    onBulkChange(bulkGroup);
  }, [bulkKey, bulkGroup, onBulkChange]);

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
            {filtered.map(p => (
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

      <div className={styles.cards}>
        {filtered.map(p => (
          <PositionCard
            key={`${p.broker}-${p.ticket}`}
            position={p}
            pnlMode={pnlMode}
            balance={balances[p.broker ?? '']}
            color={colors.get(posKey(p.broker!, p.ticket))}
            onColorChange={onColorChange}
            onEdit={handleEdit}
            onClose={handleClose}
            onOpenChart={handleOpenChart}
          />
        ))}
      </div>

      <BulkEditPanel
        open={!!editPosition}
        positions={editPosition ? [editPosition] : []}
        onClose={() => setEditPosition(null)}
      />

      <ConfirmPanel
        open={!!confirmClose}
        title="Close position?"
        description={confirmClose ? `${TYPE_LABEL[confirmClose.type]} ${confirmClose.symbol} — ${fmt(confirmClose.lots, 2)} lots` : ''}
        detail={confirmClose?.broker}
        confirmLabel="Close"
        confirming={closing}
        onConfirm={confirmAndClose}
        onClose={() => setConfirmClose(null)}
      />
    </>
  );
}
