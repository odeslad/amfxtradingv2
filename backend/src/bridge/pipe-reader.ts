import net from 'net';
import { EventEmitter } from 'events';

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

export class PipeReader extends EventEmitter {
  private readonly pipePath: string;
  private readonly brokerName: string;
  private server: net.Server | null = null;

  constructor(brokerName: string) {
    super();
    this.brokerName = brokerName;
    this.pipePath = `\\\\.\\pipe\\mt4tick_${brokerName}`;
  }

  start() {
    this.server = net.createServer((socket) => {
      console.log(`[PIPE-READER:${this.brokerName}] EA connected`);
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
            if (Array.isArray(parsed)) {
              this.emit('ticks', parsed as TickBatch);
            } else if (parsed?.type === 'positions') {
              this.emit('positions', parsed.positions);
            }
          } catch {
            console.warn(`[PIPE-READER:${this.brokerName}] Failed to parse pipe message`);
          }
        }
      });

      socket.on('close', () => {
        console.log(`[PIPE-READER:${this.brokerName}] EA disconnected`);
      });

      socket.on('error', (err) => {
        console.error(`[PIPE-READER:${this.brokerName}] Socket error:`, err.message);
      });
    });

    this.server.listen(this.pipePath, () => {
      console.log(`[PIPE-READER:${this.brokerName}] Listening on ${this.pipePath}`);
    });

    this.server.on('error', (err) => {
      console.error(`[PIPE-READER:${this.brokerName}] Server error:`, err.message);
    });
  }

  stop() {
    this.server?.close();
  }
}
