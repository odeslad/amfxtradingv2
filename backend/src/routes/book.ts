import { Router } from 'express';
import {
  RESULTS, SLOTS, type Direction, type Result, type Slot,
} from '../book/calc';
import {
  createScheme, createTrade, deleteScheme, deleteTrade, getScheme, listSchemes, nextSchemeNumber, previewTrade, updateScheme, updateTrade,
} from '../book/repository';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import {
  bodyRecord, finiteNumber, intParam, oneOf, optionalFiniteNumber, optionalInteger, optionalOneOf, optionalString, singleQuery,
} from '../middleware/parse';

// The operator's book of schemes (spec 020): informational, hand-kept, with no
// link to the live trading. Every route is behind requireAuth (app.ts).

const router = Router();
const DIRECTIONS: readonly Direction[] = ['buy', 'sell'];
const RESULT_INPUTS: readonly (Result | 'auto')[] = ['auto', ...RESULTS];
const PAGE_SIZES = [25, 50, 100] as const;

const idParam = (raw: string | undefined): number => {
  const id = intParam(raw, 'id', { min: 1 });
  if (id === undefined) throw new BadRequest('id is required');
  return id;
};

// "2026-09-10" or "2026-09-10 17:59" (document style) or ISO; always read as UTC.
function parseDate(value: unknown, key: string): Date {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequest(`${key} is required`);
  const text = value.trim().replace(' ', 'T');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : /Z$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}${text.length === 16 ? ':00' : ''}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new BadRequest(`${key} must be a date`);
  return d;
}

const optionalDate = (value: unknown, key: string): Date | null | undefined =>
  value === undefined ? undefined : value === null || value === '' ? null : parseDate(value, key);

router.get('/schemes', asyncRoute(async (req, res) => {
  const yearRaw = singleQuery(req.query, 'year');
  const year = yearRaw === undefined || yearRaw === 'all' ? (yearRaw === 'all' ? 'all' : undefined) : intParam(yearRaw, 'year', { min: 2000, max: 2100 });
  const page = intParam(singleQuery(req.query, 'page'), 'page', { min: 1, default: 1 }) ?? 1;
  const pageSize = intParam(singleQuery(req.query, 'pageSize'), 'pageSize', { min: 25, max: 100, default: 25 }) ?? 25;
  if (!(PAGE_SIZES as readonly number[]).includes(pageSize)) throw new BadRequest('pageSize must be 25, 50 or 100');
  const result = await listSchemes(year ?? 'latest', page, pageSize);
  res.json({ ...result, page, pageSize, nextNumber: await nextSchemeNumber() });
}));

router.post('/schemes', asyncRoute(async (req, res) => {
  const body = bodyRecord(req.body);
  const number = optionalInteger(body.number, 'number', { min: 1 }) ?? await nextSchemeNumber();
  const scheme = await createScheme({
    number, start: parseDate(body.start, 'start'), end: optionalDate(body.end, 'end') ?? null,
    result: optionalOneOf(body.result, 'result', RESULT_INPUTS) ?? 'auto', note: optionalString(body.note, 'note') ?? null,
  });
  res.status(201).json({ scheme });
}));

router.get('/schemes/:id', asyncRoute(async (req, res) => {
  res.json({ scheme: await getScheme(idParam(req.params['id'])) });
}));

router.put('/schemes/:id', asyncRoute(async (req, res) => {
  const body = bodyRecord(req.body);
  const patch = {
    number: optionalInteger(body.number, 'number', { min: 1 }),
    start: body.start === undefined ? undefined : parseDate(body.start, 'start'),
    end: optionalDate(body.end, 'end'),
    result: optionalOneOf(body.result, 'result', RESULT_INPUTS),
    note: body.note === null ? null : optionalString(body.note, 'note'),
  };
  if (Object.values(patch).every(v => v === undefined)) throw new BadRequest('nothing to update');
  res.json({ scheme: await updateScheme(idParam(req.params['id']), patch) });
}));

router.delete('/schemes/:id', asyncRoute(async (req, res) => {
  await deleteScheme(idParam(req.params['id']));
  res.status(204).end();
}));

function tradeFields(body: Record<string, unknown>, required: boolean) {
  const entry = required ? finiteNumber(body.entry, 'entry', { positive: true }) : optionalFiniteNumber(body.entry, 'entry', { positive: true });
  const sl = required ? finiteNumber(body.sl, 'sl', { positive: true }) : optionalFiniteNumber(body.sl, 'sl', { positive: true });
  const closePrice = body.closePrice === null || body.closePrice === '' ? null : optionalFiniteNumber(body.closePrice, 'closePrice', { positive: true });
  const closeTime = optionalDate(body.closeTime, 'closeTime');
  if ((closePrice === null) !== (closeTime === null) && closePrice !== undefined && closeTime !== undefined) {
    throw new BadRequest('closeTime and closePrice go together: both for a closed operation, neither for an open one');
  }
  return {
    slot: required ? oneOf(body.slot, 'slot', SLOTS as readonly Slot[]) : optionalOneOf(body.slot, 'slot', SLOTS as readonly Slot[]),
    direction: required ? oneOf(body.direction, 'direction', DIRECTIONS) : optionalOneOf(body.direction, 'direction', DIRECTIONS),
    entry, sl,
    openTime: required ? parseDate(body.openTime, 'openTime') : (body.openTime === undefined ? undefined : parseDate(body.openTime, 'openTime')),
    closeTime, closePrice,
    lots: body.lots === null ? null : optionalFiniteNumber(body.lots, 'lots', { positive: true }),
    note: body.note === null ? null : optionalString(body.note, 'note'),
  };
}

router.post('/trades', asyncRoute(async (req, res) => {
  const body = bodyRecord(req.body);
  const schemeId = optionalInteger(body.schemeId, 'schemeId', { min: 1 });
  if (schemeId === undefined) throw new BadRequest('schemeId is required');
  const f = tradeFields(body, true);
  if (f.entry === f.sl) throw new BadRequest('sl must differ from entry');
  if (f.closeTime && f.openTime && f.closeTime < f.openTime) throw new BadRequest('closeTime must not be before openTime');
  const trade = await createTrade({
    schemeId, slot: f.slot as Slot, direction: f.direction as Direction, entry: f.entry as number, sl: f.sl as number,
    openTime: f.openTime as Date, closeTime: f.closeTime ?? null, closePrice: f.closePrice ?? null, lots: f.lots ?? null, note: f.note ?? null,
  });
  res.status(201).json({ trade });
}));

router.put('/trades/:id', asyncRoute(async (req, res) => {
  const f = tradeFields(bodyRecord(req.body), false);
  if (Object.values(f).every(v => v === undefined)) throw new BadRequest('nothing to update');
  const patch = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
  res.json({ trade: await updateTrade(idParam(req.params['id']), patch) });
}));

router.delete('/trades/:id', asyncRoute(async (req, res) => {
  await deleteTrade(idParam(req.params['id']));
  res.status(204).end();
}));

// Figures a trade body would get, without saving (the panel's preview).
router.post('/preview', asyncRoute(async (req, res) => {
  const body = bodyRecord(req.body);
  const f = tradeFields(body, true);
  if (f.entry === f.sl) throw new BadRequest('sl must differ from entry');
  res.json(await previewTrade({
    direction: f.direction as Direction, entry: f.entry as number, sl: f.sl as number, closePrice: f.closePrice ?? null,
    lots: f.lots ?? null, tradeId: optionalInteger(body.tradeId, 'tradeId', { min: 1 }),
  }));
}));

export default router;
