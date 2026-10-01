import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getBid, getAllBids } from '../store/ticks';
import { getAccount } from '../store/accounts';
import { calculateLots } from '../services/sizing';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import {
  bodyRecord, nonEmptyString, oneOf, optionalOneOf, finiteNumber, optionalFiniteNumber, optionalInteger,
} from '../middleware/parse';

export const ACTIONS = ['buy', 'sell', 'buylimit', 'selllimit', 'buystop', 'sellstop', 'close', 'modify'] as const;
const LOTS_MODES = ['fixed', 'risk_pct'] as const;
const TICKET_ACTIONS: ReadonlySet<string> = new Set(['close', 'modify']);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

interface CommandInput {
  action: (typeof ACTIONS)[number];
  id: string;
  broker: string;
  symbol: string;
  lotsMode?: (typeof LOTS_MODES)[number];
  lots?: number;
  sl?: number;
  tp?: number;
  price?: number;
  ticket?: number;
}

// Everything is checked before the 202 and before anything reaches command.json:
// the EA silently drops what it cannot execute, which showed up as 10 s timeouts.
function parseCommand(raw: unknown): CommandInput {
  const body = bodyRecord(raw);
  const action = oneOf(body.action, 'action', ACTIONS);
  const id = nonEmptyString(body.id, 'id');
  if (!ID_RE.test(id)) throw new BadRequest('id must match ^[A-Za-z0-9_-]{1,64}$');
  const lotsMode = optionalOneOf(body.lotsMode, 'lotsMode', LOTS_MODES);
  const needsLots = !TICKET_ACTIONS.has(action);
  const lots = needsLots
    ? finiteNumber(body.lots, lotsMode === 'risk_pct' ? 'lots (risk %)' : 'lots', { positive: true })
    : optionalFiniteNumber(body.lots, 'lots', { positive: true });
  const ticket = optionalInteger(body.ticket, 'ticket', { min: 1 });
  if (TICKET_ACTIONS.has(action) && ticket === undefined) throw new BadRequest(`ticket is required for ${action}`);
  return {
    action,
    id,
    broker: nonEmptyString(body.broker, 'broker'),
    symbol: nonEmptyString(body.symbol, 'symbol'),
    lotsMode,
    lots,
    sl: optionalFiniteNumber(body.sl, 'sl', { min: 0 }),
    tp: optionalFiniteNumber(body.tp, 'tp', { min: 0 }),
    price: optionalFiniteNumber(body.price, 'price', { min: 0 }),
    ticket,
  };
}

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
        try { fs.unlinkSync(resultPath); } catch { /* best effort: a stale result.json is overwritten by the next command */ }
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

router.post('/', asyncRoute(async (req, res) => {
  const { action, id, broker, symbol, lotsMode, lots: rawLots, sl, tp, price, ticket } = parseCommand(req.body);

  const brokerConfig = config.brokers.find((b) => b.name === broker);
  if (!brokerConfig) {
    res.status(404).json({ error: `Unknown broker: ${broker}` });
    return;
  }

  let lots = rawLots;

  if (lotsMode === 'risk_pct') {
    if (rawLots === undefined) throw new BadRequest('lots (risk %) is required for risk % sizing');
    if (!sl) {
      res.status(400).json({ error: 'SL is required for risk % sizing' });
      return;
    }

    const account = getAccount(broker);
    if (!account) {
      res.status(503).json({ error: 'Account data not available yet' });
      return;
    }

    const bid = getBid(broker, symbol);
    if (!bid) {
      res.status(503).json({ error: 'Tick data not available yet for this symbol' });
      return;
    }

    const allBids = getAllBids(broker);
    lots = calculateLots(account.balance, rawLots, sl, bid, symbol, account.currency, allBids);
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
      broadcaster?.(id, 'error', undefined, 'Failed to write command');
      return;
    }

    await waitForResult(resultPath, id)
      .then((result) => {
        const status = String(result['status'] ?? 'unknown');
        const ticket = typeof result['ticket'] === 'number' ? result['ticket'] : undefined;
        const code = result['code'] !== undefined ? ` (code ${result['code']})` : '';
        broadcaster?.(id, status, ticket, status !== 'ok' ? `EA error${code}` : undefined);
        console.log(`[CMD:${broker}] result id=${id} status=${status} ticket=${ticket ?? '-'}`);
      })
      .catch(() => {
        broadcaster?.(id, 'timeout', undefined, 'No response from EA');
        console.warn(`[CMD:${broker}] timeout waiting for result id=${id}`);
      });
  });
}));

export default router;
