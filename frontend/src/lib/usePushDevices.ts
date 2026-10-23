import { useCallback, useEffect, useState } from 'react';
import { apiSend } from './api';
import { useRemoteList } from './useRemoteList';

export interface PushDevice {
  id: number;
  label: string;          // "Chrome · Windows", "Safari · iPhone", …
  endpointHash: string;   // first 16 hex chars of sha256(endpoint), to recognise this device
  createdAt: string;
  lastPushAt: string | null;
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function currentEndpointHash(): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? await hashEndpoint(sub.endpoint) : null;
  } catch {
    return null;
  }
}

// The user's push devices and which of them is this browser (by endpoint hash).
export function usePushDevices() {
  const { items: devices, refresh, mutate } = useRemoteList<PushDevice>('/push');
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [detectTick, setDetectTick] = useState(0);

  // This browser's subscription endpoint, hashed like the server does.
  useEffect(() => {
    let live = true;
    currentEndpointHash().then(hash => { if (live) setCurrentHash(hash); });
    return () => { live = false; };
  }, [detectTick]);

  const remove = useCallback((id: number) =>
    mutate(() => apiSend(`/push/${id}`, 'DELETE')), [mutate]);

  // After a subscribe: reload the list and re-detect this device.
  const reload = useCallback(async () => {
    await refresh();
    setDetectTick(t => t + 1);
  }, [refresh]);

  const thisDeviceSubscribed = currentHash !== null && devices.some(d => d.endpointHash === currentHash);

  return { devices, currentHash, thisDeviceSubscribed, remove, reload };
}
