import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface OrderCommand {
  action: 'buy' | 'sell' | 'buylimit' | 'selllimit' | 'buystop' | 'sellstop' | 'close' | 'modify';
  symbol: string;
  lots?: number;
  sl?: number;
  tp?: number;
  price?: number;
  ticket?: number;
  magic: number;
}

export interface OrderResult {
  status: 'ok' | 'error';
  ticket?: number;
  code?: number;
  id: string;
}

const TIMEOUT_MS = 5000;
const POLL_MS = 100;

export class OrderExecutor {
  private readonly bridgePath: string;
  private readonly brokerName: string;

  constructor(brokerName: string, bridgePath: string) {
    this.brokerName = brokerName;
    this.bridgePath = bridgePath;
  }

  async execute(command: OrderCommand): Promise<OrderResult> {
    const commandPath = path.join(this.bridgePath, 'command.json');
    const resultPath  = path.join(this.bridgePath, 'result.json');
    const pendingPath = path.join(this.bridgePath, 'pending.json');

    if (fs.existsSync(pendingPath)) {
      throw new Error(`[EXECUTOR:${this.brokerName}] pending.json exists — previous command still processing`);
    }

    if (fs.existsSync(resultPath)) {
      fs.unlinkSync(resultPath);
    }

    const id = randomUUID();
    const payload = JSON.stringify({ ...command, id });
    fs.writeFileSync(commandPath, payload, 'utf8');

    console.log(`[EXECUTOR:${this.brokerName}] command sent | action=${command.action} symbol=${command.symbol} id=${id}`);

    return this.waitForResult(resultPath, id);
  }

  private waitForResult(resultPath: string, id: string): Promise<OrderResult> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + TIMEOUT_MS;

      const poll = setInterval(() => {
        if (!fs.existsSync(resultPath)) {
          if (Date.now() > deadline) {
            clearInterval(poll);
            reject(new Error(`[EXECUTOR:${this.brokerName}] timeout waiting for result | id=${id}`));
          }
          return;
        }

        clearInterval(poll);

        try {
          const raw = fs.readFileSync(resultPath, 'utf8');
          fs.unlinkSync(resultPath);
          const result = JSON.parse(raw) as OrderResult;
          console.log(`[EXECUTOR:${this.brokerName}] result received | status=${result.status} ticket=${result.ticket ?? '-'} id=${id}`);
          resolve(result);
        } catch (err) {
          reject(new Error(`[EXECUTOR:${this.brokerName}] failed to read result.json | id=${id}`));
        }
      }, POLL_MS);
    });
  }
}
