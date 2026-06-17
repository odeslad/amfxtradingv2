import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { config } from '../config';

export interface BridgeAccount {
  balance: number; equity: number; profit: number;
  margin: number; freeMargin: number; leverage: number;
  currency: string; name: string; number: number;
}

export interface BridgePosition {
  ticket: number; symbol: string; type: number; lots: number;
  openPrice: number; sl: number; tp: number; profit: number;
  swap: number; commission: number; magic: number;
  comment: string; openTime: string;
}

export interface BridgeTrade extends BridgePosition {
  closePrice: number;
  closeTime: string;
}

export interface BridgeCandles {
  brokerOffset: number;
  candles: { time: number; open: number; high: number; low: number; close: number }[];
}

const TIMEFRAME_RE = /^candles_(.+)_(M5|M15|H1|H4|D1)\.json$/;

class FileWatcher extends EventEmitter {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(intervalMs = 30_000) {
    super();
    this.intervalMs = intervalMs;
  }

  start() {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private poll() {
    const bridgePath = config.bridgePath;
    this.readJson<BridgeAccount>('account.json',   bridgePath, (data) => this.emit('account',   data));
    this.readJson<BridgePosition[]>('positions.json', bridgePath, (data) => this.emit('positions', data));
    this.readJson<BridgeTrade[]>('history.json',   bridgePath, (data) => this.emit('history',   data));
    this.readCandles(bridgePath);
  }

  private readJson<T>(filename: string, dir: string, cb: (data: T) => void) {
    const filepath = path.join(dir, filename);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      cb(JSON.parse(raw) as T);
    } catch {
      // file missing or malformed — EA may not have written it yet
    }
  }

  private readCandles(dir: string) {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const file of files) {
      const match = TIMEFRAME_RE.exec(file);
      if (!match) continue;
      const [, symbol, timeframe] = match;
      this.readJson<BridgeCandles>(file, dir, (data) => {
        this.emit('candles', { symbol, timeframe, ...data });
      });
    }
  }
}

export const fileWatcher = new FileWatcher();
