import { useState } from 'react';
import { OpenPositions } from './OpenPositions';
import { ClosedPositions } from './ClosedPositions';
import { Accounts } from './Accounts';
import { Filters, type FilterValues, type FilterOptions } from './Filters';
import { NewTradePanel } from './NewTradePanel';
import styles from './JournalPage.module.css';

type Tab = 'accounts' | 'open' | 'closed';

const DEFAULT_FILTERS: FilterValues = { broker: '', symbol: '', type: '', color: '' };
const DEFAULT_OPTIONS: FilterOptions = { brokers: [], symbols: [], colors: [] };

export function JournalPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [openOptions, setOpenOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [closedOptions, setClosedOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [panelOpen, setPanelOpen] = useState(false);

  const filterOptions = tab === 'open' ? openOptions : closedOptions;

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setFilters(DEFAULT_FILTERS);
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
              <Filters values={filters} options={filterOptions} onChange={setFilters} />
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
          <Filters values={filters} options={filterOptions} onChange={setFilters} />
        </div>
      )}

      <NewTradePanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <div className={styles.tabContent}>
        <div className={tab === 'accounts' ? styles.tabPanel : styles.tabPanelHidden}>
          <Accounts />
        </div>
        <div className={tab === 'open' ? styles.tabPanel : styles.tabPanelHidden}>
          <OpenPositions filters={filters} onOptionsChange={setOpenOptions} />
        </div>
        <div className={tab === 'closed' ? styles.tabPanel : styles.tabPanelHidden}>
          <ClosedPositions filters={filters} onOptionsChange={setClosedOptions} />
        </div>
      </div>
    </div>
  );
}
