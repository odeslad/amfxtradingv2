import { Router } from 'express';
import { db } from '../db/client';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, NotFound } from '../middleware/errors';
import { bodyRecord, integer, intParam, optionalBoolean, optionalFiniteNumber, optionalInteger, optionalOneOf, optionalString, nonEmptyString } from '../middleware/parse';
import { refreshEmaNotifications } from '../alerts/ema-notification-store';

// Standing EMA cross notification rules of the signed-in user (spec 023).

const router = Router();

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;
const EVENTS = ['cross', 'approach', 'both'] as const;
const DIRECTIONS = ['buy', 'sell', 'both'] as const;

type State = 'active' | 'paused' | 'ended';

function symbolsField(value: unknown, required: boolean): string[] | undefined {
  if (value === undefined) {
    if (required) throw new BadRequest('symbols is required (an array; empty = every symbol of the broker)');
    return undefined;
  }
  if (!Array.isArray(value) || value.some(s => typeof s !== 'string' || s.trim() === '')) {
    throw new BadRequest('symbols must be an array of non-empty strings');
  }
  return [...new Set((value as string[]).map(s => s.trim().toUpperCase()))];
}

function endsAtField(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new BadRequest('endsAt must be an ISO date or null');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequest('endsAt must be a valid ISO date');
  return d;
}

function repeatField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return integer(value, 'repeatMinutes', { min: 1 });
}

function noteField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = optionalString(value, 'note') ?? '';
  return s.trim() === '' ? null : s.trim().slice(0, 500);
}

interface RuleFields {
  broker?: string;
  symbols?: string[];
  timeframe?: typeof TIMEFRAMES[number];
  emaFast?: number;
  emaSlow?: number;
  event?: typeof EVENTS[number];
  thresholdPips?: number;
  direction?: typeof DIRECTIONS[number];
  repeatMinutes?: number | null;
  endsAt?: Date | null;
  enabled?: boolean;
  note?: string | null;
}

// Every field is optional on a PUT; `required` makes the POST demand the core ones.
function parseRule(raw: unknown, required: boolean): RuleFields {
  const body = bodyRecord(raw);
  const req = <T>(v: T | undefined, key: string): T | undefined => {
    if (required && v === undefined) throw new BadRequest(`${key} is required`);
    return v;
  };
  const fields: RuleFields = {
    broker: req(body.broker === undefined ? undefined : nonEmptyString(body.broker, 'broker'), 'broker'),
    symbols: symbolsField(body.symbols, required),
    timeframe: req(optionalOneOf(body.timeframe, 'timeframe', TIMEFRAMES), 'timeframe'),
    emaFast: req(optionalInteger(body.emaFast, 'emaFast', { min: 1 }), 'emaFast'),
    emaSlow: req(optionalInteger(body.emaSlow, 'emaSlow', { min: 1 }), 'emaSlow'),
    event: req(optionalOneOf(body.event, 'event', EVENTS), 'event'),
    thresholdPips: optionalFiniteNumber(body.thresholdPips, 'thresholdPips', { positive: true }),
    direction: req(optionalOneOf(body.direction, 'direction', DIRECTIONS), 'direction'),
    repeatMinutes: repeatField(body.repeatMinutes),
    endsAt: endsAtField(body.endsAt),
    enabled: optionalBoolean(body.enabled, 'enabled'),
    note: noteField(body.note),
  };
  return fields;
}

function checkConsistency(fields: RuleFields, current?: { emaFast: number; emaSlow: number; event: string; thresholdPips: number }): void {
  const fast = fields.emaFast ?? current?.emaFast;
  const slow = fields.emaSlow ?? current?.emaSlow;
  if (fast !== undefined && slow !== undefined && fast === slow) throw new BadRequest('emaFast and emaSlow must differ');
  const event = fields.event ?? current?.event;
  const threshold = fields.thresholdPips ?? current?.thresholdPips;
  if (event !== 'cross' && (threshold === undefined || threshold <= 0)) throw new BadRequest('thresholdPips must be a positive number for approach notifications');
}

const stateOf = (r: { enabled: boolean; endsAt: Date | null }): State =>
  r.endsAt !== null && r.endsAt.getTime() <= Date.now() ? 'ended' : r.enabled ? 'active' : 'paused';

async function serialize(rule: {
  id: number; broker: string; symbols: string[]; timeframe: string; emaFast: number; emaSlow: number; event: string;
  thresholdPips: number; direction: string; repeatMinutes: number | null; endsAt: Date | null; enabled: boolean;
  note: string | null; createdAt: Date;
}) {
  const last = await db.emaNotificationEvent.findFirst({
    where: { notificationId: rule.id },
    orderBy: { firedAt: 'desc' },
    select: { symbol: true, kind: true, direction: true, firedAt: true },
  });
  return { ...rule, state: stateOf(rule), lastFired: last };
}

router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const rules = await db.emaNotification.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'desc' } });
  res.json(await Promise.all(rules.map(serialize)));
}));

router.post('/', asyncRoute<AuthRequest>(async (req, res) => {
  const f = parseRule(req.body, true);
  checkConsistency(f);
  const rule = await db.emaNotification.create({
    data: {
      userId: req.userId!, broker: f.broker!, symbols: f.symbols!, timeframe: f.timeframe!, emaFast: f.emaFast!, emaSlow: f.emaSlow!,
      event: f.event!, thresholdPips: f.thresholdPips ?? 2, direction: f.direction!, repeatMinutes: f.repeatMinutes ?? null,
      endsAt: f.endsAt ?? null, enabled: f.enabled ?? true, note: f.note ?? null,
    },
  });
  await refreshEmaNotifications();
  res.status(201).json(await serialize(rule));
}));

const idParam = (raw: string): number => {
  const id = intParam(raw, 'id', { min: 1 });
  if (id === undefined) throw new BadRequest('id is required');
  return id;
};

router.put('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = idParam(req.params.id);
  const existing = await db.emaNotification.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) throw new NotFound('notification not found');
  const f = parseRule(req.body, false);
  checkConsistency(f, existing);
  const rule = await db.emaNotification.update({
    where: { id },
    data: {
      ...(f.broker !== undefined ? { broker: f.broker } : {}),
      ...(f.symbols !== undefined ? { symbols: f.symbols } : {}),
      ...(f.timeframe !== undefined ? { timeframe: f.timeframe } : {}),
      ...(f.emaFast !== undefined ? { emaFast: f.emaFast } : {}),
      ...(f.emaSlow !== undefined ? { emaSlow: f.emaSlow } : {}),
      ...(f.event !== undefined ? { event: f.event } : {}),
      ...(f.thresholdPips !== undefined ? { thresholdPips: f.thresholdPips } : {}),
      ...(f.direction !== undefined ? { direction: f.direction } : {}),
      ...(f.repeatMinutes !== undefined ? { repeatMinutes: f.repeatMinutes } : {}),
      ...(f.endsAt !== undefined ? { endsAt: f.endsAt } : {}),
      ...(f.enabled !== undefined ? { enabled: f.enabled } : {}),
      ...(f.note !== undefined ? { note: f.note } : {}),
    },
  });
  await refreshEmaNotifications();
  res.json(await serialize(rule));
}));

router.delete('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = idParam(req.params.id);
  const result = await db.emaNotification.deleteMany({ where: { id, userId: req.userId! } });
  if (result.count === 0) throw new NotFound('notification not found');
  await refreshEmaNotifications();
  res.status(204).end();
}));

export default router;
