import net from 'net';
import { EventEmitter } from 'events';
import { setPipeState, touchTick } from '../store/liveness';

export type TickBatch = TickData[];

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  time: number;
  broker_offset: number;
  m5_time: number; m5_open: number; m5_high: number; m5_low: number;
  m15_time: number; m15_open: number; m15_high: number; m15_low: number;
  h1_time: number; h1_open: number; h1_high: number; h1_low: number;
  h4_time: number; h4_open: number; h4_high: number; h4_low: number;
  d1_time: number; d1_open: number; d1_high: number; d1_low: number;
}

export const RETRY_BASE_MS = 1_000;
export const RETRY_MAX_MS = 30_000;

export const retryDelay = (attempt: number): number => Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);

export class PipeReader extends EventEmitter {
  private readonly pipePath: string;
  private readonly brokerName: string;
  private server: net.Server | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private attempt = 0;
  private sockets = 0;
  private stopped = false;

  constructor(brokerName: string) {
    super();
    this.brokerName = brokerName;
    this.pipePath = `\\\\.\\pipe\\mt4tick_${brokerName}`;
  }

  start() {
    this.stopped = false;
    this.server = net.createServer((socket) => this.handleConnection(socket));
    this.server.on('listening', () => {
      this.attempt = 0;
      setPipeState(this.brokerName, 'listening');
      console.log(`[PIPE-READER:${this.brokerName}] Listening on ${this.pipePath}`);
    });
    // Covers both a failed listen and a later server error: the pipe is
    // re-opened with growing delays instead of staying dead until a restart.
    this.server.on('error', (err) => {
      if (this.stopped) return;
      const delay = retryDelay(this.attempt);
      setPipeState(this.brokerName, 'error');
      console.error(`[PIPE-READER:${this.brokerName}] listen failed (attempt ${this.attempt + 1}, retry in ${delay / 1000}s): ${err.message}`);
      this.attempt += 1;
      this.retryTimer = setTimeout(() => this.listen(), delay);
    });
    this.listen();
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.server?.close();
  }

  private listen() {
    this.retryTimer = null;
    this.server?.listen(this.pipePath);
  }

  // The EA may hold more than one socket for a moment (re-attach, two charts):
  // the pipe counts as connected while any of them is open.
  private handleConnection(socket: net.Socket) {
    this.sockets += 1;
    setPipeState(this.brokerName, 'connected');
    console.log(`[PIPE-READER:${this.brokerName}] EA connected (sockets: ${this.sockets})`);
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          touchTick(this.brokerName);
          if (Array.isArray(parsed)) {
            this.emit('ticks', parsed as TickBatch);
          } else if (parsed?.type === 'positions') {
            this.emit('positions', parsed.positions);
          } else if (parsed?.type === 'account') {
            const { type: _, ...account } = parsed;
            this.emit('account', account);
          }
        } catch {
          console.warn(`[PIPE-READER:${this.brokerName}] Failed to parse pipe message`);
        }
      }
    });

    socket.on('close', () => {
      this.sockets = Math.max(0, this.sockets - 1);
      if (this.sockets === 0) setPipeState(this.brokerName, 'listening');
      console.log(`[PIPE-READER:${this.brokerName}] EA disconnected (sockets: ${this.sockets})`);
    });

    socket.on('error', (err) => {
      console.error(`[PIPE-READER:${this.brokerName}] Socket error:`, err.message);
    });
  }
}
