import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { DEFAULT_EMA_TRADES, type EmaTradesSettings } from '../features/chart/emaTrades';

// Reads the EMA cross trades parameters once per mount (spec 039), like useDisplaySettings.
export function useEmaTradesSettings(): EmaTradesSettings {
  const [settings, setSettings] = useState<EmaTradesSettings>(DEFAULT_EMA_TRADES);

  useEffect(() => {
    apiFetch<{ display?: { emaTrades?: Partial<EmaTradesSettings> } }>('/settings')
      .then(data => {
        if (data?.display?.emaTrades) setSettings({ ...DEFAULT_EMA_TRADES, ...data.display.emaTrades });
      })
      .catch(() => {});
  }, []);

  return settings;
}
