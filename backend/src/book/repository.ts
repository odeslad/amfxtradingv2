import type { Prisma } from '@prisma/client';
import { db } from '../db/client';
import { Conflict, NotFound } from '../middleware/errors';
import {
  START_BALANCE, chain, effectiveResult, figuresFor, lotsFor, summaryOf, totalsOf,
  type Direction, type EffectiveResult, type Result, type Slot, type Summary, type Totals,
} from './calc';

// Access to the book tables. Derived figures live in the rows (lots, pips, €, R,
// balance after); `recomputeFrom` rewrites the balance chain whenever an
// operation changes. Summaries and totals are computed on read.

export interface BookTradeDto {
  id: number;
  ticket: number;
  schemeId: number;
  slot: Slot;
  direction: Direction;
  lots: number;
  entry: number;
  sl: number;
  openTime: string;
  closeTime: string | null;
  closePrice: number | null;
  pips: number | null;
  profit: number | null;
  r: number | null;
  balanceAfter: number | null;
  note: string | null;
}

export interface BookSchemeDto extends Summary {
  id: number;
  number: number;
  start: string;
  end: string | null;
  storedResult: string;
  result: EffectiveResult;
  note: string | null;
  trades: BookTradeDto[];
}

export interface BookPage {
  schemes: BookSchemeDto[];
  total: number;
  totals: Totals;
  years: number[];
}

type SchemeRow = Prisma.BookSchemeGetPayload<{ include: { trades: true } }>;
type TradeRow = Prisma.BookTradeGetPayload<Record<string, never>>;

const day = (d: Date): string => d.toISOString().slice(0, 10);

function toTrade(row: TradeRow): BookTradeDto {
  const pipsGained = row.closePrice === null ? null : Math.round((((row.closePrice - row.entry) / 0.0001) * (row.direction === 'buy' ? 1 : -1)) * 10) / 10;
  return {
    id: row.id, ticket: row.ticket, schemeId: row.schemeId, slot: row.slot as Slot, direction: row.direction as Direction,
    lots: row.lots, entry: row.entry, sl: row.sl, openTime: row.openTime.toISOString(), closeTime: row.closeTime?.toISOString() ?? null,
    closePrice: row.closePrice, pips: pipsGained, profit: row.profit, r: row.r, balanceAfter: row.balanceAfter, note: row.note,
  };
}

function toScheme(row: SchemeRow): BookSchemeDto {
  const trades = row.trades.map(toTrade).sort((a, b) => a.ticket - b.ticket);
  return {
    id: row.id, number: row.number, start: day(row.start), end: row.end ? day(row.end) : null,
    storedResult: row.result, result: effectiveResult(row.result, trades, row.end !== null), note: row.note,
    trades, ...summaryOf(trades),
  };
}

const yearRange = (year: number) => ({ gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) });

export async function listYears(): Promise<number[]> {
  const rows = await db.$queryRaw<{ year: number }[]>`SELECT DISTINCT EXTRACT(YEAR FROM "start")::int AS year FROM "book_schemes" ORDER BY year DESC`;
  return rows.map(r => r.year);
}

export async function listSchemes(year: number | 'all', page: number, pageSize: number): Promise<BookPage> {
  const where: Prisma.BookSchemeWhereInput = year === 'all' ? {} : { start: yearRange(year) };
  const [rows, total, all, years] = await Promise.all([
    db.bookScheme.findMany({ where, orderBy: { number: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { trades: true } }),
    db.bookScheme.count({ where }),
    db.bookScheme.findMany({ where, include: { trades: true } }),
    listYears(),
  ]);
  const totals = totalsOf(all.map(toScheme));
  return { schemes: rows.map(toScheme), total, totals, years };
}

export async function getScheme(id: number): Promise<BookSchemeDto> {
  const row = await db.bookScheme.findUnique({ where: { id }, include: { trades: true } });
  if (!row) throw new NotFound(`scheme ${id} not found`);
  return toScheme(row);
}

export async function nextSchemeNumber(): Promise<number> {
  const last = await db.bookScheme.aggregate({ _max: { number: true } });
  return (last._max.number ?? 0) + 1;
}

export async function createScheme(input: { number: number; start: Date; end?: Date | null; result?: Result | 'auto'; note?: string | null }): Promise<BookSchemeDto> {
  const taken = await db.bookScheme.findUnique({ where: { number: input.number }, select: { id: true } });
  if (taken) throw new Conflict(`scheme number ${input.number} is already used`);
  const row = await db.bookScheme.create({
    data: { number: input.number, start: input.start, end: input.end ?? null, result: input.result ?? 'auto', note: input.note ?? null },
    include: { trades: true },
  });
  return toScheme(row);
}

export async function updateScheme(id: number, patch: { number?: number; start?: Date; end?: Date | null; result?: Result | 'auto'; note?: string | null }): Promise<BookSchemeDto> {
  if (patch.number !== undefined) {
    const taken = await db.bookScheme.findFirst({ where: { number: patch.number, NOT: { id } }, select: { id: true } });
    if (taken) throw new Conflict(`scheme number ${patch.number} is already used`);
  }
  const exists = await db.bookScheme.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFound(`scheme ${id} not found`);
  const row = await db.bookScheme.update({ where: { id }, data: patch, include: { trades: true } });
  return toScheme(row);
}

// Deleting a scheme removes its operations; the chain is recomputed.
export async function deleteScheme(id: number): Promise<void> {
  const row = await db.bookScheme.findUnique({ where: { id }, include: { trades: { select: { ticket: true } } } });
  if (!row) throw new NotFound(`scheme ${id} not found`);
  await db.bookScheme.delete({ where: { id } });
  if (row.trades.length) await recomputeAll();
}

export interface TradeInputDto {
  schemeId: number;
  slot: Slot;
  direction: Direction;
  entry: number;
  sl: number;
  openTime: Date;
  closeTime?: Date | null;
  closePrice?: number | null;
  lots?: number | null; // given → kept; absent → proposed from the balance and the SL
  note?: string | null;
}

// Balance the next operation is sized on: the latest balance after a close
// (the start balance when nothing has closed yet). Editing an old operation
// re-proposes against the balance before its own close.
async function riskBaseFor(ticket: number): Promise<number> {
  const self = await db.bookTrade.findFirst({ where: { ticket }, select: { closeTime: true } });
  const where = self?.closeTime ? { closeTime: { lt: self.closeTime }, balanceAfter: { not: null } } : { balanceAfter: { not: null } };
  const prev = await db.bookTrade.findFirst({ where, orderBy: { closeTime: 'desc' }, select: { balanceAfter: true } });
  return prev?.balanceAfter ?? START_BALANCE;
}

export async function nextTicket(): Promise<number> {
  const last = await db.bookTrade.aggregate({ _max: { ticket: true } });
  return (last._max.ticket ?? 0) + 1;
}

export async function createTrade(input: TradeInputDto): Promise<BookTradeDto> {
  const scheme = await db.bookScheme.findUnique({ where: { id: input.schemeId }, select: { id: true } });
  if (!scheme) throw new NotFound(`scheme ${input.schemeId} not found`);
  const ticket = await nextTicket();
  const lots = input.lots ?? lotsFor(await riskBaseFor(ticket), input.entry, input.sl);
  const row = await db.bookTrade.create({
    data: {
      ticket, schemeId: input.schemeId, slot: input.slot, direction: input.direction, entry: input.entry, sl: input.sl,
      openTime: input.openTime, closeTime: input.closeTime ?? null, closePrice: input.closePrice ?? null, note: input.note ?? null, lots,
    },
  });
  await recomputeAll();
  return toTrade(await db.bookTrade.findUniqueOrThrow({ where: { id: row.id } }));
}

export async function updateTrade(id: number, patch: Partial<Omit<TradeInputDto, 'schemeId'>>): Promise<BookTradeDto> {
  const row = await db.bookTrade.findUnique({ where: { id } });
  if (!row) throw new NotFound(`trade ${id} not found`);
  const { lots, ...fields } = patch;
  // Lots given are kept; lots sent as null ask for the 1 % proposal again.
  const entry = fields.entry ?? row.entry;
  const sl = fields.sl ?? row.sl;
  const nextLots = lots === null ? lotsFor(await riskBaseFor(row.ticket), entry, sl) : lots;
  await db.bookTrade.update({ where: { id }, data: { ...fields, ...(nextLots !== undefined ? { lots: nextLots } : {}) } });
  await recomputeAll();
  const fresh = await db.bookTrade.findUniqueOrThrow({ where: { id } });
  return toTrade(fresh);
}

export async function deleteTrade(id: number): Promise<void> {
  const row = await db.bookTrade.findUnique({ where: { id }, select: { ticket: true } });
  if (!row) throw new NotFound(`trade ${id} not found`);
  await db.bookTrade.delete({ where: { id } });
  await recomputeAll();
}

// Rewrites €, R and balance of every operation from the rows' own lots (the
// balance chains in close order, so a change anywhere can move any balance).
export async function recomputeAll(): Promise<number> {
  const rows = await db.bookTrade.findMany({ orderBy: { ticket: 'asc' } });
  if (rows.length === 0) return 0;
  const computed = chain(rows.map(r => ({
    id: r.id, ticket: r.ticket, direction: r.direction as Direction, entry: r.entry, sl: r.sl, lots: r.lots, closePrice: r.closePrice, closeTime: r.closeTime,
  })));
  const changed = computed.filter(c => {
    const r = rows.find(x => x.id === c.id) as TradeRow;
    return r.profit !== c.profit || r.r !== c.r || r.balanceAfter !== c.balanceAfter;
  });
  if (changed.length) {
    await db.$transaction(changed.map(c => db.bookTrade.update({ where: { id: c.id }, data: { profit: c.profit, r: c.r, balanceAfter: c.balanceAfter } })));
  }
  return changed.length;
}

// Figures a trade body would get, without saving (the panel's preview).
export async function previewTrade(input: { direction: Direction; entry: number; sl: number; closePrice: number | null; lots?: number | null; tradeId?: number }) {
  const ticket = input.tradeId !== undefined
    ? (await db.bookTrade.findUnique({ where: { id: input.tradeId }, select: { ticket: true } }))?.ticket ?? await nextTicket()
    : await nextTicket();
  const riskBase = await riskBaseFor(ticket);
  const proposedLots = lotsFor(riskBase, input.entry, input.sl);
  const figures = figuresFor(riskBase, input, input.lots ?? proposedLots);
  return { ticket, riskBase, proposedLots, ...figures };
}
