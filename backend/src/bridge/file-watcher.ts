import fs from 'fs';
import path from 'path';
import { touchSync } from '../store/liveness';

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
const LIST_ERROR_EVERY_MS = 60_000;

export type AccountHandler = (account: BridgeAccount) => Promise<void>;
export type HistoryHandler = (entries: BridgeTrade[]) => Promise<void>;
export type CandlesHandler = (
  payload: { symbol: string; timeframe: string } & BridgeCandles,
) => Promise<void>;

interface FileStamp {
  mtimeMs: number;
  size: number;
}

// Polls the EA's bridge files and hands each one to an awaited handler, so a
// poll never overlaps the previous one and a slow DB cannot stack writes.
export class FileWatcher {
  private readonly brokerName: string;
  private readonly bridgePath: string;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private accountHandler: AccountHandler | null = null;
  private historyHandler: HistoryHandler | null = null;
  private candlesHandler: CandlesHandler | null = null;
  private polling = false;
  // Candle files already persisted, by name: skipped while mtime and size hold.
  private readonly seen = new Map<string, FileStamp>();
  private lastListErrorAt = 0;

  constructor(brokerName: string, bridgePath: string, intervalMs = 30_000) {
    this.brokerName = brokerName;
    this.bridgePath = bridgePath;
    this.intervalMs = intervalMs;
  }

  onAccount(handler: AccountHandler) { this.accountHandler = handler; }
  onHistory(handler: HistoryHandler) { this.historyHandler = handler; }
  onCandles(handler: CandlesHandler) { this.candlesHandler = handler; }

  start() {
    console.log(`[FILE-WATCHER: ${this.brokerName}] started | polls account, history, candles every ${this.intervalMs / 1000}s`);
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.runStep('account', () => this.handleAccount());
      await this.runStep('history', () => this.handleHistory());
      await this.readCandles();
    } finally {
      this.polling = false;
      touchSync(this.brokerName);
    }
  }

  // A failing step is logged and the poll moves on; nothing can leave `polling` stuck.
  private async runStep(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[FILE-WATCHER: ${this.brokerName}] ${label} failed`, err);
    }
  }

  private async handleAccount() {
    if (!this.accountHandler) return;
    const account = this.readJson<BridgeAccount>('account.json');
    if (account) await this.accountHandler(account);
  }

  private async handleHistory() {
    if (!this.historyHandler) return;
    const history = this.readJson<BridgeTrade[]>('history.json');
    if (history) await this.historyHandler(history);
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
    if (!this.candlesHandler) return;
    let files: string[];
    try {
      files = fs.readdirSync(this.bridgePath);
    } catch (err) {
      // A broken bridge path would otherwise print the same line every poll.
      const now = Date.now();
      if (now - this.lastListErrorAt >= LIST_ERROR_EVERY_MS) {
        this.lastListErrorAt = now;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[FILE-WATCHER: ${this.brokerName}] cannot list ${this.bridgePath} | ${msg}`);
      }
      return;
    }
    // One file at a time: parse, persist, release before touching the next,
    // so memory holds a single candles file instead of all of them at once.
    for (const file of files) {
      const match = TIMEFRAME_RE.exec(file);
      if (!match) continue;
      const [, symbol, timeframe] = match;

      const stamp = this.stat(file);
      if (!stamp) continue;
      const prev = this.seen.get(file);
      if (prev && prev.mtimeMs === stamp.mtimeMs && prev.size === stamp.size) continue;

      const data = this.readJson<BridgeCandles>(file);
      if (!data) continue;
      // Remembered only after a successful write, so a DB failure is retried next poll.
      await this.runStep(file, async () => {
        await this.candlesHandler!({ symbol, timeframe, ...data });
        this.seen.set(file, stamp);
      });
    }
  }

  private stat(filename: string): FileStamp | null {
    try {
      const { mtimeMs, size } = fs.statSync(path.join(this.bridgePath, filename));
      return { mtimeMs, size };
    } catch {
      return null;
    }
  }
}
