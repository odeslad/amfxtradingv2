import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getBid, getAllBids } from '../store/ticks';
import { getAccount } from '../store/accounts';
import { calculateLots } from '../services/sizing';

type Broadcaster = (id: string, status: string, ticket?: number, error?: string) => void;

let broadcaster: Broadcaster | null = null;

export function setBroadcaster(fn: Broadcaster) {
  broadcaster = fn;
}

type QueueTask = () => Promise<void>;
const brokerQueues = new Map<string, Promise<void>>();

function enqueue(broker: string, task: QueueTask): void {
  const prev = brokerQueues.get(broker) ?? Promise.resolve();
  const next = prev.then(task).catch(() => {});
  brokerQueues.set(broker, next);
}

const router = Router();

function waitForResult(resultPath: string, id: string, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      try {
        if (!fs.existsSync(resultPath)) {
          if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            reject(new Error('timeout'));
          }
          return;
        }
        const raw = fs.readFileSync(resultPath, 'utf8');
        const result = JSON.parse(raw) as Record<string, unknown>;
        if (result['id'] !== id) {
          if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            reject(new Error('timeout'));
          }
          return;
        }
        clearInterval(timer);
        try { fs.unlinkSync(resultPath); } catch {}
        resolve(result);
      } catch {
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('timeout'));
        }
      }
    }, 300);
  });
}

router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const { action, id, broker, symbol, lotsMode, lots: rawLots, sl, tp, price, ticket } = body as {
    action: string; id: string; broker: string; symbol: string;
    lotsMode?: string; lots: number; sl?: number; tp?: number; price?: number; ticket?: number;
  };

  if (!action || !id || !broker || !symbol) {
    res.status(400).json({ error: 'action, id, broker and symbol are required' });
    return;
  }

  const brokerConfig = config.brokers.find((b) => b.name === broker);
  if (!brokerConfig) {
    res.status(404).json({ error: `Unknown broker: ${broker}` });
    return;
  }

  let lots = rawLots;

  if (lotsMode === 'risk_pct') {
    if (!sl) {
      res.status(400).json({ error: 'SL is required for risk % sizing' });
      return;
    }

    const account = getAccount(broker);
    if (!account) {
      res.status(503).json({ error: 'Account data not available yet' });
      return;
    }

    const bid = getBid(broker, symbol as string);
    if (!bid) {
      res.status(503).json({ error: 'Tick data not available yet for this symbol' });
      return;
    }

    const allBids = getAllBids(broker);
    lots = calculateLots(account.balance, rawLots, sl, bid, symbol as string, account.currency, allBids);
  }

  const commandPath = path.join(brokerConfig.bridgePath, 'command.json');
  const resultPath = path.join(brokerConfig.bridgePath, 'result.json');

  const command = {
    action, id, broker, symbol, lots,
    sl: sl ?? 0, tp: tp ?? 0,
    ...(price ? { price } : {}),
    ...(ticket !== undefined ? { ticket } : {}),
  };

  res.status(202).json({ status: 'pending', id });

  enqueue(broker, async () => {
    try {
      fs.writeFileSync(commandPath, JSON.stringify(command));
    } catch (err) {
      console.error(`[CMD:${broker}] Failed to write command.json`, err);
      broadcaster?.(id as string, 'error', undefined, 'Failed to write command');
      return;
    }

    await waitForResult(resultPath, id as string)
      .then((result) => {
        const status = String(result['status'] ?? 'unknown');
        const ticket = typeof result['ticket'] === 'number' ? result['ticket'] : undefined;
        const code = result['code'] !== undefined ? ` (code ${result['code']})` : '';
        broadcaster?.(id as string, status, ticket, status !== 'ok' ? `EA error${code}` : undefined);
        console.log(`[CMD:${broker}] result id=${id} status=${status} ticket=${ticket ?? '-'}`);
      })
      .catch(() => {
        broadcaster?.(id as string, 'timeout', undefined, 'No response from EA');
        console.warn(`[CMD:${broker}] timeout waiting for result id=${id}`);
      });
  });
});

export default router;
