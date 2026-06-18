import { EventEmitter } from 'events';
import type { TickData } from '../bridge/pipe-reader';

export interface CandleCloseEvent {
  symbol: string;
  timeframe: string;
  time: number;
}

const TIMEFRAMES: Array<{ key: string; timeField: keyof TickData }> = [
  { key: 'M5', timeField: 'm5_time' },
  { key: 'M15', timeField: 'm15_time' },
  { key: 'H1', timeField: 'h1_time' },
  { key: 'H4', timeField: 'h4_time' },
  { key: 'D1', timeField: 'd1_time' },
];

export class CandleTracker extends EventEmitter {
  private readonly brokerName: string;
  private lastTimes = new Map<string, number>();

  constructor(brokerName: string) {
    super();
    this.brokerName = brokerName;
  }

  processTick(tick: TickData) {
    for (const { key, timeField } of TIMEFRAMES) {
      const current = tick[timeField] as number;
      const mapKey = `${tick.symbol}:${key}`;
      const last = this.lastTimes.get(mapKey);

      if (last !== undefined && current !== last) {
        const event: CandleCloseEvent = { symbol: tick.symbol, timeframe: key, time: last };
        const candle = new Date(last * 1000).toISOString();
        const detected = new Date().toISOString();
        console.log(`[ENGINE:${this.brokerName}] candle-tracker: CLOSE ${key} | ${tick.symbol} | candle=${candle} detected=${detected}`);
        this.emit('close', event);
      }

      this.lastTimes.set(mapKey, current);
    }
  }
}
