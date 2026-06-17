import net from 'net';
import { EventEmitter } from 'events';

export type TickBatch = TickData[];

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  time: number;
  broker_offset: number;
  m5_time: number;  m5_open: number;  m5_high: number;  m5_low: number;
  m15_time: number; m15_open: number; m15_high: number; m15_low: number;
  h1_time: number;  h1_open: number;  h1_high: number;  h1_low: number;
  h4_time: number;  h4_open: number;  h4_high: number;  h4_low: number;
  d1_time: number;  d1_open: number;  d1_high: number;  d1_low: number;
}

class PipeReader extends EventEmitter {
  private readonly pipePath = '\\\\.\\pipe\\mt4tick';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private buffer = '';

  start() {
    this.connect();
  }

  private connect() {
    const socket = net.createConnection(this.pipePath);

    socket.on('connect', () => {
      console.log('[PIPE] Connected');
      this.buffer = '';
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    socket.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const batch: TickBatch = JSON.parse(trimmed);
          this.emit('ticks', batch);
        } catch {
          console.warn('[PIPE] Failed to parse tick batch');
        }
      }
    });

    socket.on('close', () => {
      console.log('[PIPE] Disconnected — reconnecting in 5s');
      this.scheduleReconnect();
    });

    socket.on('error', () => {
      socket.destroy();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }
}

export const pipeReader = new PipeReader();
