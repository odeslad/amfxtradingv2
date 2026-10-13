import { useState, useEffect } from 'react';
import { apiFetch } from './api';
import type { PnlMode } from '../features/journal/utils/position';

export interface DisplaySettings {
  pnlMode: PnlMode;
}

const DEFAULTS: DisplaySettings = { pnlMode: 'net' };

export function useDisplaySettings(): DisplaySettings {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULTS);

  useEffect(() => {
    apiFetch<{ display?: { pnlMode?: PnlMode } }>('/settings')
      .then((data) => {
        if (data?.display) setSettings({ pnlMode: data.display.pnlMode ?? 'net' });
      })
      .catch(() => {});
  }, []);

  return settings;
}
