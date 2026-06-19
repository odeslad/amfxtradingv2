import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import styles from './SettingsPage.module.css';

interface MirrorBroker {
  id?: number;
  broker: string;
  enabled: boolean;
  lotsMode: 'fixed' | 'risk_pct';
  lots: number;
}

interface Balance {
  broker: string;
}

export function SettingsPage() {
  const [mirror, setMirror] = useState<MirrorBroker[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/settings'), { credentials: 'include' }).then(r => r.json()) as Promise<{ mirror: MirrorBroker[] }>,
      fetch(apiUrl('/balances'), { credentials: 'include' }).then(r => r.json()) as Promise<Balance[]>,
    ]).then(([settings, balances]) => {
      const existing = new Map(settings.mirror.map(m => [m.broker, m]));
      const merged = balances.map(b => existing.get(b.broker) ?? {
        broker: b.broker,
        enabled: false,
        lotsMode: 'fixed' as const,
        lots: 0.01,
      });
      setMirror(merged);
    }).catch(() => {});
  }, []);

  const updateBroker = useCallback((broker: string, patch: Partial<MirrorBroker>) => {
    setMirror(prev => prev.map(m => m.broker === broker ? { ...m, ...patch } : m));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(apiUrl('/settings'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mirror }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Mirror</h2>
          <p className={styles.sectionDesc}>Replicate trades across brokers. Configure lot size per broker.</p>
        </div>

        <div className={styles.brokerList}>
          {mirror.map(m => (
            <div key={m.broker} className={`${styles.brokerRow} ${m.enabled ? styles.brokerRowActive : ''}`}>
              <div className={styles.brokerName}>{m.broker.toUpperCase()}</div>

              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={e => updateBroker(m.broker, { enabled: e.target.checked })}
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
              </label>

              <select
                className={styles.select}
                value={m.lotsMode}
                disabled={!m.enabled}
                onChange={e => updateBroker(m.broker, { lotsMode: e.target.value as 'fixed' | 'risk_pct' })}
              >
                <option value="fixed">Fixed lots</option>
                <option value="risk_pct">% Risk</option>
              </select>

              <input
                className={styles.input}
                type="number"
                step={m.lotsMode === 'fixed' ? '0.01' : '0.1'}
                min="0"
                value={m.lots}
                disabled={!m.enabled}
                onChange={e => updateBroker(m.broker, { lots: parseFloat(e.target.value) || 0 })}
              />

              <span className={styles.lotsUnit}>{m.lotsMode === 'fixed' ? 'lots' : '%'}</span>
            </div>
          ))}

          {mirror.length === 0 && (
            <div className={styles.empty}>No brokers connected</div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
