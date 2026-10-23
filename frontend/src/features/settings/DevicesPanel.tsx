import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { usePush } from '../../lib/usePush';
import { type PushDevice } from '../../lib/usePushDevices';
import styles from '../journal/BulkEditPanel.module.css';
import own from './DevicesPanel.module.css';

interface DevicesPanelProps {
  open: boolean;
  devices: PushDevice[];
  currentHash: string | null;
  thisDeviceSubscribed: boolean;
  onRemove: (id: number) => Promise<unknown>;
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}

const p = (n: number) => String(n).padStart(2, '0');
const fmtDate = (iso: string): string => { const d = new Date(iso); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDateTime = (iso: string): string => { const d = new Date(iso); return `${fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function DevicesPanel({ open, devices, currentHash, thisDeviceSubscribed, onRemove, onChanged, onClose }: DevicesPanelProps) {
  const { status, busy, subscribe } = usePush();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const enable = async () => {
    const ok = await subscribe();
    if (ok) { addToast('Notifications enabled on this device', 'success'); await onChanged(); }
    else if (status !== 'denied') addToast('Could not enable notifications on this device', 'error');
  };

  const remove = async (id: number) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setRemoving(true);
    try {
      await onRemove(id);
      addToast('Device removed', 'success');
      setConfirmId(null);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to remove the device'), 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Devices</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          {!thisDeviceSubscribed && (
            <div className={own.enableBox}>
              <span className={own.enableTitle}>This device · notifications off</span>
              {status === 'unsupported' ? (
                <span className={own.enableNote}>Push is not available here. On iPhone, install the app on the home screen first and open it from there.</span>
              ) : status === 'denied' ? (
                <span className={own.enableNote}>Notifications are blocked for this site. Allow them in the browser settings, then enable.</span>
              ) : (
                <>
                  <span className={own.enableNote}>Enable once to receive pushes with the app closed.</span>
                  <button type="button" className={styles.submitBtn} onClick={enable} disabled={busy}>
                    {busy ? 'Enabling…' : 'Enable this device'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className={own.list}>
            <span className={own.listLabel}>Subscribed devices · {devices.length}</span>
            {devices.length === 0 && <span className={own.empty}>No device receives pushes yet.</span>}
            {devices.map(d => (
              <div key={d.id} className={own.row}>
                <span className={own.rowMain}>
                  <span>{d.label}{d.endpointHash === currentHash && <span className={`${own.rowMeta} ${own.thisDevice}`}>this device</span>}</span>
                  <span className={own.rowMeta}>since {fmtDate(d.createdAt)}{d.lastPushAt ? ` · last push ${fmtDateTime(d.lastPushAt)}` : ' · no push yet'}</span>
                </span>
                <button
                  type="button"
                  className={`${own.removeBtn} ${confirmId === d.id ? own.confirmBtn : ''}`}
                  onClick={() => remove(d.id)}
                  onBlur={() => { if (confirmId === d.id && !removing) setConfirmId(null); }}
                  disabled={removing}
                >
                  {confirmId === d.id ? (removing ? 'Removing…' : 'Confirm') : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
