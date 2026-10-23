import { apiSend } from './api';
import type { Position } from '../features/journal/utils/position';

export type CommandAction = 'buy' | 'sell' | 'buylimit' | 'selllimit' | 'buystop' | 'sellstop' | 'close' | 'modify';
export type LotsMode = 'fixed' | 'risk_pct';

export interface Command {
  id: string;
  action: CommandAction;
  broker: string;
  symbol: string;
  lots?: number;
  lotsMode?: LotsMode;
  sl?: number;
  tp?: number;
  price?: number;
  ticket?: number;
}

type PositionRef = Pick<Position, 'broker' | 'symbol' | 'ticket' | 'lots'>;

export function newCommandId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function closeCommand(p: PositionRef): Command {
  return { id: newCommandId(), action: 'close', broker: p.broker ?? '', symbol: p.symbol, ticket: p.ticket, lots: p.lots };
}

// `price` moves a pending order; it is only sent when given, so position edits are unchanged.
export function modifyCommand(p: PositionRef, sl: number, tp: number, price?: number): Command {
  return { ...closeCommand(p), action: 'modify', sl, tp, ...(price !== undefined ? { price } : {}) };
}

// Resolves to the command id so callers can match the WS command_result.
export async function sendCommand(cmd: Command): Promise<string> {
  await apiSend('/commands', 'POST', cmd);
  return cmd.id;
}

// Sends every command; rejects with "N of M commands rejected: <first reason>" when any fails.
export async function sendCommands(cmds: Command[]): Promise<void> {
  const results = await Promise.allSettled(cmds.map(sendCommand));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length > 0) {
    const reason = failed[0].reason;
    const text = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`${failed.length} of ${results.length} commands rejected: ${text}`);
  }
}
