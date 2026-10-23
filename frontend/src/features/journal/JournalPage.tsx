import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OpenPositions, type BulkGroup } from './OpenPositions';
import { PendingOrders } from './PendingOrders';
import { ClosedPositions } from './ClosedPositions';
import { Accounts } from './Accounts';
import { FiltersPanel, type FilterValues, type FilterOptions } from './FiltersPanel';
import { OrderFiltersPanel } from './OrderFiltersPanel';
import { DEFAULT_ORDER_FILTERS, hasActiveOrderFilters, type OrderFilterValues } from './utils/orderFilters';
import { NewTradePanel } from './NewTradePanel';
import { BulkEditPanel } from './BulkEditPanel';
import { ConfirmPanel } from './ConfirmPanel';
import { CancelOrdersPanel } from './CancelOrdersPanel';
import { errorMessage } from '../../lib/api';
import { closeCommand, sendCommands } from '../../lib/commands';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { addToast } from '../../lib/toast';
import { type Position, TYPE_LABEL, fmt, isPending } from './utils/position';
import { useLivePositions } from './useLivePositions';
import styles from './JournalPage.module.css';

type Tab = 'accounts' | 'open' | 'orders' | 'closed';

const DEFAULT_FILTERS: FilterValues = {
  broker: '', symbol: '', type: '', color: '',
  dateRange: '', dateFrom: '', dateTo: '',
};
const DEFAULT_OPTIONS: FilterOptions = { brokers: [], symbols: [], colors: [] };

export function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // A deep link lands on Orders with ?tab=orders, else on Positions when it carries a broker.
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'orders' ? 'orders' : searchParams.get('broker') ? 'open' : 'accounts'));
  const [storedFilters, setFilters] = useLocalStorage<FilterValues>('journal.filters', DEFAULT_FILTERS);
  const [storedOrderFilters, setOrderFilters] = useLocalStorage<OrderFilterValues>('journal.orderFilters', DEFAULT_ORDER_FILTERS);
  // Stored filters may predate some fields; merge so every key exists.
  // Memoised: a fresh object every render retriggers the group effects in the
  // tabs, which set state here and loop the render infinitely.
  const filters: FilterValues = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...storedFilters }),
    [storedFilters],
  );
  const orderFilters: OrderFilterValues = useMemo(
    () => ({ ...DEFAULT_ORDER_FILTERS, ...storedOrderFilters }),
    [storedOrderFilters],
  );

  useEffect(() => {
    const broker = searchParams.get('broker');
    const symbol = searchParams.get('symbol');
    if (broker) {
      const seed = { broker, ...(symbol ? { symbol } : {}) };
      if (searchParams.get('tab') === 'orders') setOrderFilters(f => ({ ...f, ...seed }));
      else setFilters(f => ({ ...f, ...seed }));
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useLivePositions();
  const openPositions = useMemo(() => live.positions.filter(p => !isPending(p.type)), [live.positions]);
  const pendingOrders = useMemo(() => live.positions.filter(p => isPending(p.type)), [live.positions]);

  const [openOptions, setOpenOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [orderOptions, setOrderOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [closedOptions, setClosedOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulk, setBulk] = useState<BulkGroup | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkConfirmClose, setBulkConfirmClose] = useState(false);
  const [bulkClosing, setBulkClosing] = useState(false);
  const [orderGroup, setOrderGroup] = useState<Position[] | null>(null);
  const [cancelOrders, setCancelOrders] = useState<Position[] | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const filterOptions = tab === 'open' ? openOptions : closedOptions;
  const hasActiveFilters = tab === 'orders'
    ? hasActiveOrderFilters(orderFilters)
    : !!(filters.broker || filters.symbol || filters.type || filters.color || (tab === 'closed' && filters.dateRange));

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setBulk(null);
  };

  const handleSelectBroker = (broker: string) => {
    setFilters(f => ({ ...f, broker }));
    setTab('open');
    setBulk(null);
  };

  const handleBulkChange = useCallback((group: BulkGroup | null) => {
    setBulk(group);
  }, []);

  const handleOrderGroupChange = useCallback((group: Position[] | null) => {
    setOrderGroup(group);
  }, []);

  const handleBulkClose = async () => {
    if (!bulk) return;
    setBulkClosing(true);
    try {
      await sendCommands(bulk.positions.map(closeCommand));
      addToast(`Close sent for ${bulk.positions.length} positions`, 'info');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to send close commands'), 'error');
    } finally {
      setBulkClosing(false);
      setBulkConfirmClose(false);
    }
  };

  const handleEditOrder = useCallback((p: Position) => {
    addToast(`Editing order ${p.ticket} arrives with the next task`, 'info');
  }, []);

  const handleCancelOrders = async () => {
    if (!cancelOrders) return;
    setCancelling(true);
    try {
      await sendCommands(cancelOrders.map(closeCommand));
      addToast(cancelOrders.length === 1 ? 'Cancel sent' : `Cancel sent for ${cancelOrders.length} orders`, 'info');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to send cancel commands'), 'error');
    } finally {
      setCancelling(false);
      setCancelOrders(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'accounts' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('accounts')}
          >
            Accounts
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'open' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('open')}
          >
            Positions
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'orders' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('orders')}
          >
            Orders
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'closed' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('closed')}
          >
            History
          </button>
        </div>

        <div className={styles.tabBarRight}>
          {tab === 'open' && bulk && (
            <>
              <button type="button" className={styles.bulkEditBtn} onClick={() => setBulkEditOpen(true)}>
                <span>Edit</span>
              </button>
              <button type="button" className={styles.bulkCloseBtn} onClick={() => setBulkConfirmClose(true)}>
                <span>Close</span>
              </button>
            </>
          )}
          {tab === 'orders' && orderGroup && (
            <>
              <button type="button" className={styles.bulkEditBtn} onClick={() => handleEditOrder(orderGroup[0])}>
                <span>Edit</span>
              </button>
              <button type="button" className={styles.bulkCloseBtn} onClick={() => setCancelOrders(orderGroup)}>
                <span>Cancel</span>
              </button>
            </>
          )}
          {tab !== 'accounts' && (
            <button
              type="button"
              className={`${styles.filtersBtn} ${hasActiveFilters ? styles.filtersBtnActive : ''}`}
              onClick={() => setFiltersOpen(true)}
            >
              <span>Filters</span>
              <span className={styles.filtersBtnMobile}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                </svg>
              </span>
              {hasActiveFilters && <span className={styles.filtersDot} />}
            </button>
          )}
          <button type="button" className={styles.newTradeBtn} onClick={() => setPanelOpen(true)}>
            <span>+ New Trade</span>
            <span className={styles.newTradeBtnMobile}>+</span>
          </button>
        </div>
      </div>

      <NewTradePanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <FiltersPanel
        open={filtersOpen && tab !== 'orders'}
        onClose={() => setFiltersOpen(false)}
        values={filters}
        options={filterOptions}
        onChange={setFilters}
        showDateFilter={tab === 'closed'}
      />

      <OrderFiltersPanel
        open={filtersOpen && tab === 'orders'}
        onClose={() => setFiltersOpen(false)}
        values={orderFilters}
        options={orderOptions}
        onChange={setOrderFilters}
      />

      <BulkEditPanel
        open={bulkEditOpen}
        positions={bulk?.positions ?? []}
        onClose={() => setBulkEditOpen(false)}
      />

      <ConfirmPanel
        open={bulkConfirmClose && !!bulk}
        title={`Close ${bulk?.positions.length ?? 0} positions?`}
        description={bulk ? `${TYPE_LABEL[bulk.type]} ${bulk.symbol}` : ''}
        detail={bulk ? bulk.positions.map(p => fmt(p.lots, 2)).join(' + ') + ' lots' : ''}
        confirmLabel="Close all"
        confirming={bulkClosing}
        onConfirm={handleBulkClose}
        onClose={() => setBulkConfirmClose(false)}
      />

      <CancelOrdersPanel
        open={!!cancelOrders}
        orders={cancelOrders ?? []}
        cancelling={cancelling}
        onConfirm={handleCancelOrders}
        onClose={() => setCancelOrders(null)}
      />

      <div className={styles.tabContent}>
        <div className={tab === 'accounts' ? styles.tabPanel : styles.tabPanelHidden}>
          <Accounts onSelectBroker={handleSelectBroker} />
        </div>
        <div className={tab === 'open' ? styles.tabPanel : styles.tabPanelHidden}>
          <OpenPositions
            positions={openPositions}
            colors={live.colors}
            onColorChange={live.setColor}
            filters={filters}
            onOptionsChange={setOpenOptions}
            onBulkChange={handleBulkChange}
          />
        </div>
        <div className={tab === 'orders' ? styles.tabPanel : styles.tabPanelHidden}>
          <PendingOrders
            orders={pendingOrders}
            colors={live.colors}
            onColorChange={live.setColor}
            filters={orderFilters}
            onOptionsChange={setOrderOptions}
            onGroupChange={handleOrderGroupChange}
            onEdit={handleEditOrder}
            onCancel={p => setCancelOrders([p])}
          />
        </div>
        <div className={tab === 'closed' ? styles.tabPanel : styles.tabPanelHidden}>
          <ClosedPositions filters={filters} onOptionsChange={setClosedOptions} />
        </div>
      </div>
    </div>
  );
}
