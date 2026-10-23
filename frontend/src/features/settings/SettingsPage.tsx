import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { MirrorTab, type AccountInfo, type MirrorBroker } from './MirrorTab';
import { DisplayTab, type DisplaySettingsForm } from './DisplayTab';
import styles from './SettingsPage.module.css';

type Tab = 'mirror' | 'display' | 'notifications';

interface SettingsResponse {
  mirror: MirrorBroker[];
  display: Partial<DisplaySettingsForm>;
}

interface Balance {
  broker: string;
  name: string;
  balance: number;
  currency: string;
}

const DEFAULT_DISPLAY: DisplaySettingsForm = { pnlMode: 'net', trendlineColor: '#8c8c8c', trendlineStyle: 'dashed', trendlineWidth: 1 };

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('mirror');
  const [mirror, setMirror] = useState<MirrorBroker[]>([]);
  const [accounts, setAccounts] = useState<Record<string, AccountInfo>>({});
  const [display, setDisplay] = useState<DisplaySettingsForm>(DEFAULT_DISPLAY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      apiFetch<SettingsResponse>('/settings', { signal: ac.signal }),
      apiFetch<Balance[]>('/balances', { signal: ac.signal }),
    ]).then(([settings, balances]) => {
      const existing = new Map(settings.mirror.map(m => [m.broker, m]));
      setMirror(balances.map(b => existing.get(b.broker) ?? { broker: b.broker, enabled: false, lotsMode: 'fixed' as const, lots: 0.01 }));
      setAccounts(Object.fromEntries(balances.map(b => [b.broker, { name: b.name, balance: b.balance, currency: b.currency }])));
      setDisplay({ ...DEFAULT_DISPLAY, ...settings.display });
    }).catch(() => {});
    return () => ac.abort();
  }, []);

  const updateBroker = useCallback((broker: string, patch: Partial<MirrorBroker>) => {
    setMirror(prev => prev.map(m => m.broker === broker ? { ...m, ...patch } : m));
    setDirty(true);
  }, []);

  const updateDisplay = useCallback((patch: Partial<DisplaySettingsForm>) => {
    setDisplay(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiSend('/settings', 'PUT', { mirror, display });
      setDirty(false);
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Network error saving settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savable = tab === 'mirror' || tab === 'display';

  return (
    <div className={styles.page}>
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${tab === 'mirror' ? styles.tabActive : ''}`} onClick={() => setTab('mirror')}>Mirror</button>
          <button type="button" className={`${styles.tab} ${tab === 'display' ? styles.tabActive : ''}`} onClick={() => setTab('display')}>Display</button>
          <button type="button" className={`${styles.tab} ${tab === 'notifications' ? styles.tabActive : ''}`} onClick={() => setTab('notifications')}>Notifications</button>
        </div>

        <div className={styles.tabBarRight}>
          {savable && dirty && <span className={styles.unsaved}>Unsaved changes</span>}
          {savable && (
            <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {tab === 'mirror' && <MirrorTab mirror={mirror} accounts={accounts} onChange={updateBroker} />}
      {tab === 'display' && <DisplayTab display={display} onChange={updateDisplay} />}
      {tab === 'notifications' && <div className={styles.empty}>Notifications arrive with the next task.</div>}
    </div>
  );
}
