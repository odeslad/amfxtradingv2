import { describe, it, expect } from 'vitest';
import { chain, deriveResult, effectiveResult, figuresFor, lotsFor, pips, summaryOf, totalsOf } from './calc';

const at = (s: string): Date => new Date(s + ':00Z');

// The document's first operations:
// [1, 1, "T1", "sell", 0.14, 1.1292, 1.1365, …, close 1.1365, -102.2, -1.02, 9897.8]
// [2, 1, "T2", "buy",  0.24, 1.1334, 1.1292, …, close 1.1488, 369.6, 3.73, 10267.4]
const t1 = { ticket: 1, slot: 'T1' as const, direction: 'sell' as const, entry: 1.1292, sl: 1.1365, closePrice: 1.1365 };
const t2 = { ticket: 2, slot: 'T2' as const, direction: 'buy' as const, entry: 1.1334, sl: 1.1292, closePrice: 1.1488 };

describe('pips and lots', () => {
  it('signs pips by direction', () => {
    expect(pips('sell', 1.1292, 1.1365)).toBe(-73);
    expect(pips('buy', 1.1334, 1.1488)).toBe(154);
  });

  it('sizes 1 % of the balance over the SL distance, rounded to 0.01', () => {
    expect(lotsFor(10_000, 1.1292, 1.1365)).toBe(0.14);
    expect(lotsFor(9897.8, 1.1334, 1.1292)).toBe(0.24);
    expect(lotsFor(10_000, 1.1, 1.1)).toBe(0);
  });
});

describe('figuresFor', () => {
  it('reproduces the document for a loss and a win', () => {
    expect(figuresFor(10_000, t1)).toEqual({ lots: 0.14, pips: -73, profit: -102.2, r: -1.02 });
    expect(figuresFor(9897.8, t2)).toEqual({ lots: 0.24, pips: 154, profit: 369.6, r: 3.73 });
  });

  it('keeps the lots it is given and derives the rest from them', () => {
    expect(figuresFor(10_000, t1, 0.1)).toEqual({ lots: 0.1, pips: -73, profit: -73, r: -0.73 });
  });

  it('gives an open operation its lots only', () => {
    expect(figuresFor(10_000, { ...t1, closePrice: null })).toEqual({ lots: 0.14, pips: null, profit: null, r: null });
  });
});

describe('chain', () => {
  // Document rows 1 and 2: ticket 2 opened while ticket 1 was still open and closed after it.
  const c1 = { ...t1, lots: 0.14, closeTime: at('2015-02-03T14:10') };
  const c2 = { ...t2, lots: 0.24, closeTime: at('2015-02-03T20:59') };

  it('threads the balance and the risk base in close order', () => {
    const out = chain([c2, c1, { ticket: 3, slot: 'T1' as const, direction: 'buy' as const, entry: 1.1337, sl: 1.13, lots: 0.28, closePrice: null, closeTime: null }]);
    expect(out.map(t => t.ticket)).toEqual([1, 2, 3]);
    expect(out[0]).toMatchObject({ riskBase: 10_000, r: -1.02, balanceAfter: 9897.8 });
    expect(out[1]).toMatchObject({ riskBase: 9897.8, r: 3.73, balanceAfter: 10267.4 });
    expect(out[2]).toMatchObject({ riskBase: 10267.4, lots: 0.28, r: null, balanceAfter: null });
  });

  it('lets an operation that closed earlier take the balance first, whatever its ticket', () => {
    // Ticket 2 closes before ticket 1: both chain from the start balance in that order.
    const out = chain([{ ...c1, closeTime: at('2015-02-04T10:00') }, { ...c2, closeTime: at('2015-02-03T09:00') }]);
    expect(out[1]).toMatchObject({ riskBase: 10_000, r: 3.7, balanceAfter: 10369.6 });
    expect(out[0]).toMatchObject({ riskBase: 10369.6, r: -0.99, balanceAfter: 10267.4 });
  });
});

describe('summaryOf and results', () => {
  const closed = [
    { ticket: 1, slot: 'T1' as const, r: -1.02, profit: -102.2 },
    { ticket: 2, slot: 'T2' as const, r: 3.73, profit: 369.6 },
  ];

  it('writes the trades line, the tickets and the net figures', () => {
    expect(summaryOf(closed)).toEqual({ tradesLine: 'T1 -1.0 · T2 +3.7', tickets: '1 2', netEur: 267.4, netR: 2.71, open: 0 });
    expect(summaryOf([...closed, { ticket: 3, slot: 'T3' as const, r: null, profit: null }]).tradesLine).toBe('T1 -1.0 · T2 +3.7 · T3 …');
  });

  it('derives the result as the document does', () => {
    expect(deriveResult(closed, true)).toBe('T2');
    expect(deriveResult([{ ticket: 1, slot: 'T1', r: -1, profit: -100 }, { ticket: 2, slot: 'T2', r: -1, profit: -100 }, { ticket: 3, slot: 'T3', r: -1, profit: -100 }], true)).toBe('Pierde');
    expect(deriveResult([{ ticket: 1, slot: 'T1', r: -1, profit: -100 }, { ticket: 2, slot: 'RE', r: 2.15, profit: 215 }, { ticket: 3, slot: 'T3', r: -1, profit: -100 }], true)).toBe('Empate');
    expect(deriveResult([{ ticket: 1, slot: 'T1', r: -1, profit: -100 }, { ticket: 2, slot: 'RE', r: 2.15, profit: 215 }], true)).toBe('RE');
  });

  it('is pending without an end, without operations or with an open one', () => {
    expect(deriveResult(closed, false)).toBe('Pendiente');
    expect(deriveResult([], true)).toBe('Pendiente');
    expect(deriveResult([...closed, { ticket: 3, slot: 'T3', r: null, profit: null }], true)).toBe('Pendiente');
  });

  it('lets a hand-typed result replace the automatic one', () => {
    expect(effectiveResult('auto', closed, true)).toBe('T2');
    expect(effectiveResult('Pierde', closed, true)).toBe('Pierde');
  });
});

describe('totalsOf', () => {
  it('counts won, draws, lost and pending, with the win rate over the decided ones', () => {
    const totals = totalsOf([
      { result: 'T1', netEur: 100, netR: 2 },
      { result: 'T2', netEur: 50, netR: 1 },
      { result: 'Pierde', netEur: -300, netR: -3 },
      { result: 'Empate', netEur: 5, netR: 0.1 },
      { result: 'Pendiente', netEur: 0, netR: 0 },
    ]);
    expect(totals).toEqual({ schemes: 5, won: 2, draws: 1, lost: 1, pending: 1, winPct: 50, netEur: -145, netR: 0.1 });
  });
});
