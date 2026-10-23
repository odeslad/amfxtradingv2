import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { useEmaNotifications, type EmaNotification, type NotificationInput } from '../../lib/useEmaNotifications';
import { ConfirmPanel } from '../journal/ConfirmPanel';
import { MirrorTab, type AccountInfo, type MirrorBroker } from './MirrorTab';
import { DisplayTab, type DisplaySettingsForm } from './DisplayTab';
import { NotificationsTab } from './NotificationsTab';
import { NotificationPanel } from './NotificationPanel';
import { DevicesPanel } from './DevicesPanel';
import { usePushDevices } from '../../lib/usePushDevices';
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
  const { notifications, create, update, toggle, remove } = useEmaNotifications();
  const [panel, setPanel] = useState<{ notification: EmaNotification | null; nonce: number } | null>(null);
  const [deleting, setDeleting] = useState<EmaNotification | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pushDevices = usePushDevices();
  const [devicesOpen, setDevicesOpen] = useState(false);

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

  const saveNotification = useCallback((input: NotificationInput, id: number | null) =>
    id === null ? create(input) : update(id, input), [create, update]);

  const handleToggle = (n: EmaNotification) =>
    toggle(n).catch(err => addToast(errorMessage(err, 'Failed to update the notification'), 'error'));

  const confirmDelete = async () => {
    if (!deleting) return;
    setConfirming(true);
    try {
      await remove(deleting.id);
      addToast('Notification deleted', 'success');
      setDeleting(null);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to delete the notification'), 'error');
    } finally {
      setConfirming(false);
    }
  };

  const brokers = mirror.map(m => m.broker);
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
          {tab === 'notifications' && (
            <>
              <button
                type="button"
                className={`${styles.devicesBtn} ${pushDevices.thisDeviceSubscribed ? '' : styles.devicesBtnAttention}`}
                onClick={() => setDevicesOpen(true)}
              >
                Devices · {pushDevices.devices.length}
                {!pushDevices.thisDeviceSubscribed && <span className={styles.dot} aria-hidden="true" />}
              </button>
              <button type="button" className={styles.newBtn} onClick={() => setPanel({ notification: null, nonce: Date.now() })}>+ New notification</button>
            </>
          )}
        </div>
      </div>

      {tab === 'mirror' && <MirrorTab mirror={mirror} accounts={accounts} onChange={updateBroker} />}
      {tab === 'display' && <DisplayTab display={display} onChange={updateDisplay} />}
      {tab === 'notifications' && (
        <NotificationsTab
          notifications={notifications}
          onToggle={handleToggle}
          onEdit={n => setPanel({ notification: n, nonce: Date.now() })}
          onDelete={setDeleting}
        />
      )}

      <NotificationPanel
        open={panel !== null}
        brokers={brokers}
        notification={panel?.notification ?? null}
        nonce={panel?.nonce ?? 0}
        onSave={saveNotification}
        onClose={() => setPanel(null)}
      />

      <DevicesPanel
        open={devicesOpen}
        devices={pushDevices.devices}
        currentHash={pushDevices.currentHash}
        thisDeviceSubscribed={pushDevices.thisDeviceSubscribed}
        onRemove={pushDevices.remove}
        onChanged={pushDevices.reload}
        onClose={() => setDevicesOpen(false)}
      />

      <ConfirmPanel
        open={deleting !== null}
        title="Delete notification?"
        description={deleting ? `${deleting.symbols.length === 0 ? 'All symbols' : deleting.symbols.join(' · ')} · ${deleting.timeframe} · EMA ${deleting.emaFast}/${deleting.emaSlow}` : ''}
        detail={deleting?.broker}
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        confirming={confirming}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
