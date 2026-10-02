import { Router } from 'express';
import path from 'path';
import { config } from '../config';
import { getBid, getAllBids } from '../store/ticks';
import { getAccount } from '../store/accounts';
import { calculateLots } from '../services/sizing';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import { writeCommand, waitForResult, discardStaleResult, errorText, type CommandResult } from '../bridge/command-io';
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

type Broadcaster = (id: string, status: string, ticket?: number, error?: string, late?: boolean) => void;

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

    // A pending order is sized from its own price; a market order from the bid.
    const sized = calculateLots({
      balance: account.balance, riskPct: rawLots, entryPrice: price || bid, slPrice: sl,
      symbol, accountCurrency: account.currency, bids: getAllBids(broker),
    });
    if (!sized.ok) {
      res.status(sized.reason === 'no_conversion' ? 503 : 400).json({ error: sized.error });
      return;
    }
    lots = sized.lots;
  }

  const resultPath = path.join(brokerConfig.bridgePath, 'result.json');

  const command = {
    action, id, broker, symbol, lots,
    sl: sl ?? 0, tp: tp ?? 0,
    ...(price ? { price } : {}),
    ...(ticket !== undefined ? { ticket } : {}),
  };

  res.status(202).json({ status: 'pending', id });

  enqueue(broker, async () => {
    discardStaleResult(resultPath, msg => console.warn(`[CMD:${broker}] ${msg}`));
    try {
      writeCommand(brokerConfig.bridgePath, command);
    } catch (err) {
      console.error(`[CMD:${broker}] Failed to write command.json`, err);
      broadcaster?.(id, 'error', undefined, 'Failed to write command');
      return;
    }

    const report = (result: CommandResult, late = false) => {
      broadcaster?.(id, result.status, result.ticket, errorText(result), late);
      console.log(`[CMD:${broker}] ${late ? 'late result' : 'result'} id=${id} status=${result.status} ticket=${result.ticket ?? '-'}`);
    };

    const outcome = await waitForResult({ bridgePath: brokerConfig.bridgePath, id });
    if (outcome.kind === 'result') { report(outcome.result); return; }

    // Never picked up by the EA: withdrawn, so it cannot execute later at another price.
    if (outcome.cancelled) {
      broadcaster?.(id, 'cancelled', undefined, 'EA not running — order cancelled');
      console.warn(`[CMD:${broker}] EA did not pick up the command, cancelled id=${id}`);
    } else {
      broadcaster?.(id, 'timeout', undefined, 'No response from EA');
      console.warn(`[CMD:${broker}] timeout waiting for result id=${id}`);
    }
    // The queue moves on; a result that still shows up is reported as late.
    void outcome.late.then(result => { if (result) report(result, true); });
  });
}));

export default router;
