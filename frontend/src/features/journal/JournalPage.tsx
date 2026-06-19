import { useState } from 'react';
import { OpenPositions } from './OpenPositions';
import { ClosedPositions } from './ClosedPositions';
import styles from './JournalPage.module.css';

type Tab = 'open' | 'closed';

export function JournalPage() {
  const [tab, setTab] = useState<Tab>('open');

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'open' ? styles.tabActive : ''}`}
          onClick={() => setTab('open')}
        >
          Open Positions
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'closed' ? styles.tabActive : ''}`}
          onClick={() => setTab('closed')}
        >
          Closed Trades
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === 'open' ? <OpenPositions /> : <ClosedPositions />}
      </div>
    </div>
  );
}
