import { useState, useCallback } from 'react';
import { OpenPositions, type BulkGroup } from './OpenPositions';
import { ClosedPositions } from './ClosedPositions';
import { Accounts } from './Accounts';
import { Filters, type FilterValues, type FilterOptions } from './Filters';
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
  const [bulk, setBulk] = useState<BulkGroup | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkConfirmClose, setBulkConfirmClose] = useState(false);
  const [bulkClosing, setBulkClosing] = useState(false);

  const filterOptions = tab === 'open' ? openOptions : closedOptions;

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
          {tab !== 'accounts' && (
            <div className={styles.desktopFilters}>
              <Filters
                values={filters}
                options={filterOptions}
                onChange={setFilters}
                bulk={tab === 'open' ? bulk : null}
                onBulkEdit={() => setBulkEditOpen(true)}
                onBulkClose={() => setBulkConfirmClose(true)}
              />
            </div>
          )}
          <button type="button" className={styles.newTradeBtn} onClick={() => setPanelOpen(true)}>
            <span className={styles.newTradeBtnDesktop}>+ New Trade</span>
            <span className={styles.newTradeBtnMobile}>+</span>
          </button>
        </div>
      </div>

      {tab !== 'accounts' && (
        <div className={styles.mobileFilters}>
          <Filters
            values={filters}
            options={filterOptions}
            onChange={setFilters}
            bulk={tab === 'open' ? bulk : null}
            onBulkEdit={() => setBulkEditOpen(true)}
            onBulkClose={() => setBulkConfirmClose(true)}
          />
        </div>
      )}

      <NewTradePanel open={panelOpen} onClose={() => setPanelOpen(false)} />

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
