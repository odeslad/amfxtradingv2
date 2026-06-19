type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l([...toasts]));
}

export function addToast(message: string, type: ToastType = 'info', durationMs = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, durationMs);
}

export function subscribeToasts(fn: Listener) {
  listeners.add(fn);
  fn([...toasts]);
  return () => { listeners.delete(fn); };
}
