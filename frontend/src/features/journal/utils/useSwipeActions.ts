import { useRef, useState, type TouchEvent } from 'react';

const SWIPE_THRESHOLD = 50;
const TAP_TOLERANCE = 8;
const DOUBLE_TAP_MS = 300;

export interface SwipeActions {
  open: boolean;        // action buttons revealed by a left swipe
  expanded: boolean;    // details revealed by a tap
  touchHandlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
  };
  onSummaryClick: () => void;
}

// The card gestures shared by positions and orders: swipe left reveals the
// actions, swipe right hides them, a tap toggles the details and a double tap
// fires `onDoubleTap` (open the chart).
export function useSwipeActions(onDoubleTap?: () => void): SwipeActions {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  const startX = useRef(0);
  const lastDx = useRef(0);
  const moved = useRef(false);
  const lastTapTime = useRef(0);

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    lastDx.current = 0;
    moved.current = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    lastDx.current = e.touches[0].clientX - startX.current;
    if (Math.abs(lastDx.current) > TAP_TOLERANCE) moved.current = true;
  };

  const onTouchEnd = () => {
    if (lastDx.current < -SWIPE_THRESHOLD) setOpen(true);
    else if (lastDx.current > SWIPE_THRESHOLD) setOpen(false);
  };

  const onSummaryClick = () => {
    if (moved.current) return;
    if (open) { setOpen(false); return; }

    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      onDoubleTap?.();
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;
    setExpanded(prev => !prev);
  };

  return { open, expanded, touchHandlers: { onTouchStart, onTouchMove, onTouchEnd }, onSummaryClick };
}
