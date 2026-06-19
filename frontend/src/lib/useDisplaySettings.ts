import { useState, useEffect } from 'react';
import { apiUrl } from './api';
import type { PnlMode } from '../features/journal/utils/position';

export interface DisplaySettings {
  pnlMode: PnlMode;
}

const DEFAULTS: DisplaySettings = { pnlMode: 'net' };

export function useDisplaySettings(): DisplaySettings {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULTS);

  useEffect(() => {
    fetch(apiUrl('/settings'), { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.display) setSettings({ pnlMode: data.display.pnlMode ?? 'net' });
      })
      .catch(() => {});
  }, []);

  return settings;
}
