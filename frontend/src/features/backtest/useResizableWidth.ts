import { useCallback, useRef, useState } from 'react';

interface Options {
  min: number;
  max: number;
  initial: number;
  storageKey?: string;
}

interface Resizable {
  width: number;
  dragging: boolean;
  onHandleMouseDown: (e: React.MouseEvent) => void;
}

export function useResizableWidth({ min, max, initial, storageKey }: Options): Resizable {
  const [width, setWidth] = useState(() => {
    if (!storageKey) return initial;
    const stored = Number(localStorage.getItem(storageKey));
    return stored >= min && stored <= max ? stored : initial;
  });
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setDragging(true);

    const onMove = (move: MouseEvent) => {
      const next = Math.min(max, Math.max(min, startWidth + (move.clientX - startX)));
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setWidth(next));
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (storageKey) {
        setWidth(w => { localStorage.setItem(storageKey, String(w)); return w; });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, min, max, storageKey]);

  return { width, dragging, onHandleMouseDown };
}
