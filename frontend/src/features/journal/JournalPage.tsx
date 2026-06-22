import { useState, useCallback } from 'react';
import { OpenPositions, type BulkGroup } from './OpenPositions';
import { ClosedPositions } from './ClosedPositions';
import { Accounts } from './Accounts';
import { FiltersPanel, type FilterValues, type FilterOptions } from './FiltersPanel';
import { NewTradePanel } from './NewTradePanel';
import { BulkEditPanel } from './BulkEditPanel';
import { ConfirmPanel } from './ConfirmPanel';
import { apiUrl } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { TYPE_LABEL, fmt } from './utils/position';
import styles from './JournalPage.module.css';

type Tab = 'accounts' | 'open' | 'closed';

const DEFAULT_FILTERS: FilterValues = { broker: '', symbol: '', type: '', color: '' };
const DEFAULT_OPTIONS: FilterOptions = { brokers: [], symbols: [], colors: [] };

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export function JournalPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [openOptions, setOpenOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [closedOptions, setClosedOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulk, setBulk] = useState<BulkGroup | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkConfirmClose, setBulkConfirmClose] = useState(false);
  const [bulkClosing, setBulkClosing] = useState(false);

  const filterOptions = tab === 'open' ? openOptions : closedOptions;
  const hasActiveFilters = !!(filters.broker || filters.symbol || filters.type || filters.color);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setFilters(DEFAULT_FILTERS);
    setBulk(null);
  };

  const handleBulkChange = useCallback((group: BulkGroup | null) => {
    setBulk(group);
  }, []);

  const handleBulkClose = async () => {
    if (!bulk) return;
    setBulkClosing(true);
    try {
      await Promise.all(bulk.positions.map(p =>
        fetch(apiUrl('/commands'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: generateId(),
            action: 'close',
            broker: p.broker,
            symbol: p.symbol,
            lots: p.lots,
            ticket: p.ticket,
            sl: 0,
            tp: 0,
          }),
        })
      ));
      addToast(`Close sent for ${bulk.positions.length} positions`, 'info');
    } catch {
      addToast('Failed to send close commands', 'error');
    } finally {
      setBulkClosing(false);
      setBulkConfirmClose(false);
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
                <span className={styles.btnDesktop}>Edit</span>
              </button>
              <button type="button" className={styles.bulkCloseBtn} onClick={() => setBulkConfirmClose(true)}>
                <span className={styles.btnDesktop}>Close</span>
              </button>
            </>
          )}
          {tab !== 'accounts' && (
            <button
              type="button"
              className={`${styles.filtersBtn} ${hasActiveFilters ? styles.filtersBtnActive : ''}`}
              onClick={() => setFiltersOpen(true)}
            >
              <span className={styles.filtersBtnDesktop}>Filters</span>
              <span className={styles.filtersBtnMobile}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                </svg>
              </span>
              {hasActiveFilters && <span className={styles.filtersDot} />}
            </button>
          )}
          <button type="button" className={styles.newTradeBtn} onClick={() => setPanelOpen(true)}>
            <span className={styles.newTradeBtnDesktop}>+ New Trade</span>
            <span className={styles.newTradeBtnMobile}>+</span>
          </button>
        </div>
      </div>

      <NewTradePanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <FiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={filters}
        options={filterOptions}
        onChange={setFilters}
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

      <div className={styles.tabContent}>
        <div className={tab === 'accounts' ? styles.tabPanel : styles.tabPanelHidden}>
          <Accounts />
        </div>
        <div className={tab === 'open' ? styles.tabPanel : styles.tabPanelHidden}>
          <OpenPositions
            filters={filters}
            onOptionsChange={setOpenOptions}
            onBulkChange={handleBulkChange}
          />
        </div>
        <div className={tab === 'closed' ? styles.tabPanel : styles.tabPanelHidden}>
          <ClosedPositions filters={filters} onOptionsChange={setClosedOptions} />
        </div>
      </div>
    </div>
  );
}
