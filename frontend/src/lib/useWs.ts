import { useEffect, useRef } from 'react';
import { subscribe } from './ws';

export function useWs(onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    return subscribe((data) => onMessageRef.current(data));
  }, []);
}
