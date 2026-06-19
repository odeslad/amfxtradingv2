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
        {tab === 'accounts' && <Accounts />}
        {tab === 'open' && <OpenPositions />}
        {tab === 'closed' && <ClosedPositions />}
      </div>
    </div>
  );
}
