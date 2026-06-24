import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from './api';

// Manages the Web Push subscription lifecycle for the current browser/PWA:
// registers the service worker, requests notification permission, subscribes
// with the server's VAPID key, and reports the current status.
//
// On iPhone this only works when the site is installed as a PWA (added to the
// home screen) on iOS 16.4+.

export type PushStatus =
  | 'unsupported'   // browser has no Push API
  | 'default'       // supported, not yet asked/subscribed
  | 'denied'        // user blocked notifications
  | 'subscribed';   // active subscription

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function usePush() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported()) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }

    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(sub ? 'subscribed' : 'default'))
      .catch(() => setStatus('default'));
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported()) { setStatus('unsupported'); return false; }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return false;
      }

      const { publicKey } = await fetch(apiUrl('/push/vapid'), { credentials: 'include' })
        .then(r => r.json() as Promise<{ publicKey: string }>);
      if (!publicKey) return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(apiUrl('/push/subscribe'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      setStatus('subscribed');
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(apiUrl('/push/unsubscribe'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setStatus('default');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, subscribe, unsubscribe };
}
