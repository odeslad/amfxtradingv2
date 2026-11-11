const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

const WS_BASE = API_BASE.startsWith('/')
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${API_BASE}`
  : API_BASE.replace(/^https?/, 'wss').replace(/^http/, 'ws');

type Listener = (data: unknown) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;

// Tick subscription (spec 041): the backend sends ticks only for the broker/symbol pairs
// declared here. Components add and remove their pair; the union goes out as one
// `subscribe` frame whenever it changes and again on every (re)connect.
const tickRefs = new Map<string, number>();
let lastSent: string | null = null;
let flushScheduled = false;

function subscriptionFrame(): string {
  const ticks = [...tickRefs.keys()].map(key => {
    const at = key.lastIndexOf('|');
    return { broker: key.slice(0, at), symbol: key.slice(at + 1) };
  });
  return JSON.stringify({ type: 'subscribe', ticks });
}

function flushSubscription() {
  flushScheduled = false;
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const frame = subscriptionFrame();
  if (frame === lastSent) return;
  socket.send(frame);
  lastSent = frame;
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushSubscription);
}

export function addTickSubscription(broker: string, symbol: string) {
  const key = `${broker}|${symbol}`;
  tickRefs.set(key, (tickRefs.get(key) ?? 0) + 1);
  scheduleFlush();
}

export function removeTickSubscription(broker: string, symbol: string) {
  const key = `${broker}|${symbol}`;
  const count = tickRefs.get(key) ?? 0;
  if (count <= 1) tickRefs.delete(key);
  else tickRefs.set(key, count - 1);
  scheduleFlush();
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(`${WS_BASE}/ws`);

  socket.onopen = () => {
    lastSent = null;
    flushSubscription();
  };

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string);
      listeners.forEach(fn => fn(data));
    } catch {
      // Malformed frame: ignore it, the next one is independent.
    }
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(connect, 3000);
  };

  socket.onerror = () => socket?.close();
}

connect();

export function subscribe(fn: Listener) {
  listeners.add(fn);

  return () => {
    listeners.delete(fn);
  };
}
