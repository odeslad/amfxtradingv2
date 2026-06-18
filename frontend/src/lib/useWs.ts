import { useEffect, useRef } from 'react';

const WS_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/^https?/, 'wss').replace(/^http/, 'ws')
  : '';

export function useWs(onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const url = `${WS_BASE}/ws`;
    const ws = new WebSocket(url);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string);
        onMessageRef.current(data);
      } catch {}
    };

    ws.onerror = () => ws.close();

    return () => ws.close();
  }, []);
}
