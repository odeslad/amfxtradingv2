const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

const WS_BASE = API_BASE.startsWith('/')
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${API_BASE}`
  : API_BASE.replace(/^https?/, 'wss').replace(/^http/, 'ws');

type Listener = (data: unknown) => void;

type ResyncListener = () => void;

const RECONNECT_DELAY_MS = 3000;

const listeners = new Set<Listener>();
// Messages sent while the socket was down or the page frozen are lost for good: these
// listeners are told when that may have happened so they can reload what they missed.
const resyncListeners = new Set<ResyncListener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let hasOpened = false;

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

function notifyResync() {
  resyncListeners.forEach(fn => fn());
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const ws = new WebSocket(`${WS_BASE}/ws`);
  socket = ws;

  ws.onopen = () => {
    lastSent = null;
    flushSubscription();
    if (hasOpened) notifyResync();
    hasOpened = true;
  };

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string);
      listeners.forEach(fn => fn(data));
    } catch {
      // Malformed frame: ignore it, the next one is independent.
    }
  };

  ws.onclose = () => {
    // A socket already replaced by a newer one must not tear that one down.
    if (socket !== ws) return;
    socket = null;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  };

  ws.onerror = () => ws.close();
}

// Back in the foreground or back online: reconnect now instead of waiting for the timer
// (throttled in a background tab), and resync even over a socket that stayed open, since
// a frozen page may have had its frames dropped.
function resume() {
  if (document.hidden) return;
  if (socket?.readyState === WebSocket.OPEN) notifyResync();
  else connect();
}

connect();
document.addEventListener('visibilitychange', resume);
window.addEventListener('online', resume);

export function subscribe(fn: Listener) {
  listeners.add(fn);

  return () => {
    listeners.delete(fn);
  };
}

export function subscribeResync(fn: ResyncListener) {
  resyncListeners.add(fn);

  return () => {
    resyncListeners.delete(fn);
  };
}
