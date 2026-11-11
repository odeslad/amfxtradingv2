import { useEffect } from 'react';
import { addTickSubscription, removeTickSubscription } from './ws';

// Declares that the component needs live ticks of this broker/symbol while mounted
// (spec 041). Empty broker or symbol declares nothing.
export function useTickSubscription(broker: string, symbol: string): void {
  useEffect(() => {
    if (!broker || !symbol) return;
    addTickSubscription(broker, symbol);
    return () => removeTickSubscription(broker, symbol);
  }, [broker, symbol]);
}
