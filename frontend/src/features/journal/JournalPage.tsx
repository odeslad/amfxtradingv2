import { useState } from 'react';
import { OpenPositions } from './OpenPositions';
import { ClosedPositions } from './ClosedPositions';
import { Accounts } from './Accounts';
import styles from './JournalPage.module.css';

type Tab = 'accounts' | 'open' | 'closed';

export function JournalPage() {
  const [tab, setTab] = useState<Tab>('accounts');

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'accounts' ? styles.tabActive : ''}`}
          onClick={() => setTab('accounts')}
        >
          Accounts
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'open' ? styles.tabActive : ''}`}
          onClick={() => setTab('open')}
        >
          Positions
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'closed' ? styles.tabActive : ''}`}
          onClick={() => setTab('closed')}
        >
          History
        </button>
      </div>

      <div className={styles.tabContent}>
        <div className={tab === 'accounts' ? styles.tabPanel : styles.tabPanelHidden}>
          <Accounts />
        </div>
        <div className={tab === 'open' ? styles.tabPanel : styles.tabPanelHidden}>
          <OpenPositions />
        </div>
        <div className={tab === 'closed' ? styles.tabPanel : styles.tabPanelHidden}>
          <ClosedPositions />
        </div>
      </div>
    </div>
  );
}
