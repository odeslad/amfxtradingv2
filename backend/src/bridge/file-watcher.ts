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

export type CandlesHandler = (
  payload: { symbol: string; timeframe: string } & BridgeCandles,
) => Promise<void>;

export class FileWatcher extends EventEmitter {
  private readonly brokerName: string;
  private readonly bridgePath: string;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private candlesHandler: CandlesHandler | null = null;
  private polling = false;

  constructor(brokerName: string, bridgePath: string, intervalMs = 30_000) {
    super();
    this.brokerName = brokerName;
    this.bridgePath = bridgePath;
    this.intervalMs = intervalMs;
  }

  onCandles(handler: CandlesHandler) {
    this.candlesHandler = handler;
  }

  start() {
    console.log(`[FILE-WATCHER: ${this.brokerName}] started | polls account, history, candles every ${this.intervalMs / 1000}s`);
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    // Skip the tick if the previous poll is still persisting candles, so
    // slow DB writes never stack up parsed files in memory.
    if (this.polling) return;
    this.polling = true;
    try {
      const account = this.readJson<BridgeAccount>('account.json');
      if (account) this.emit('account', account);
      const history = this.readJson<BridgeTrade[]>('history.json');
      if (history) this.emit('history', history);
      await this.readCandles();
    } finally {
      this.polling = false;
    }
  }

  private readJson<T>(filename: string): T | null {
    const filepath = path.join(this.bridgePath, filename);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(raw) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('ENOENT')) {
        console.error(`[FILE-WATCHER: ${this.brokerName}] error reading ${filename} | ${msg}`);
      }
      return null;
    }
  }

  private async readCandles() {
    let files: string[];
    try {
      files = fs.readdirSync(this.bridgePath);
    } catch {
      return;
    }
    // One file at a time: parse, persist, release before touching the next,
    // so memory holds a single candles file instead of all of them at once.
    for (const file of files) {
      const match = TIMEFRAME_RE.exec(file);
      if (!match) continue;
      const [, symbol, timeframe] = match;
      const data = this.readJson<BridgeCandles>(file);
      if (!data || !this.candlesHandler) continue;
      await this.candlesHandler({ symbol, timeframe, ...data });
    }
  }
}
