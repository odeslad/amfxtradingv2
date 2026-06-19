const WS_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/^https?/, 'wss').replace(/^http/, 'ws')
  : '';

type Listener = (data: unknown) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(`${WS_BASE}/ws`);

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string);
      listeners.forEach(fn => fn(data));
    } catch {}
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
