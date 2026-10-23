export interface OrderFilterValues {
  broker: string;
  symbol: string;
  orderType: string;   // '' | '2' | '3' | '4' | '5'
  side: string;        // '' | 'buy' | 'sell'
  color: string;
}

export const DEFAULT_ORDER_FILTERS: OrderFilterValues = { broker: '', symbol: '', orderType: '', side: '', color: '' };

export const hasActiveOrderFilters = (v: OrderFilterValues): boolean =>
  !!(v.broker || v.symbol || v.orderType || v.side || v.color);
