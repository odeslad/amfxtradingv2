import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

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

export class FileWatcher extends EventEmitter {
  private readonly brokerName: string;
  private readonly bridgePath: string;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(brokerName: string, bridgePath: string, intervalMs = 30_000) {
    super();
    this.brokerName = brokerName;
    this.bridgePath = bridgePath;
    this.intervalMs = intervalMs;
  }

  start() {
    console.log(`[FILE-WATCHER: ${this.brokerName}] started | polls account, positions, history, candles every ${this.intervalMs / 1000}s`);
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private poll() {
    this.readJson<BridgeAccount>('account.json', (data) => this.emit('account', data));
    this.readJson<BridgePosition[]>('positions.json', (data) => this.emit('positions', data));
    this.readJson<BridgeTrade[]>('history.json', (data) => this.emit('history', data));
    this.readCandles();
  }

  private readJson<T>(filename: string, cb: (data: T) => void) {
    const filepath = path.join(this.bridgePath, filename);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      cb(JSON.parse(raw) as T);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('ENOENT')) {
        console.error(`[FILE-WATCHER: ${this.brokerName}] error reading ${filename} | ${msg}`);
      }
    }
  }

  private readCandles() {
    let files: string[];
    try {
      files = fs.readdirSync(this.bridgePath);
    } catch {
      return;
    }
    for (const file of files) {
      const match = TIMEFRAME_RE.exec(file);
      if (!match) continue;
      const [, symbol, timeframe] = match;
      this.readJson<BridgeCandles>(file, (data) => {
        this.emit('candles', { symbol, timeframe, ...data });
      });
    }
  }
}
