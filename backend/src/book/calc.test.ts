import { describe, it, expect } from 'vitest';
import { chain, deriveResult, effectiveResult, figuresFor, lotsFor, pips, summaryOf, totalsOf } from './calc';

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
    expect(figuresFor(10_000, t1)).toEqual({ lots: 0.14, pips: -73, profit: -102.2, r: -1.02, balanceAfter: 9897.8 });
    expect(figuresFor(9897.8, t2)).toEqual({ lots: 0.24, pips: 154, profit: 369.6, r: 3.73, balanceAfter: 10267.4 });
  });

  it('gives an open operation its lots only', () => {
    expect(figuresFor(10_000, { ...t1, closePrice: null })).toEqual({ lots: 0.14, pips: null, profit: null, r: null, balanceAfter: null });
  });
});

describe('chain', () => {
  it('threads the balance through the operations in ticket order, skipping open ones', () => {
    const out = chain([t2, { ...t1 }, { ticket: 3, slot: 'T1' as const, direction: 'buy' as const, entry: 1.1337, sl: 1.1300, closePrice: null }]);
    expect(out.map(t => t.ticket)).toEqual([1, 2, 3]);
    expect(out[1].balanceAfter).toBe(10267.4);
    expect(out[2].lots).toBe(0.28);
    expect(out[2].balanceAfter).toBeNull();
  });
});

describe('summaryOf and results', () => {
  const closed = [
    { ticket: 1, slot: 'T1' as const, r: -1.02, profit: -102.2 },
    { ticket: 2, slot: 'T2' as const, r: 3.73, profit: 369.6 },
  ];

  it('writes the trades line, the tickets and the net figures', () => {
    expect(summaryOf(closed)).toEqual({ trades: 'T1 -1.0 · T2 +3.7', tickets: '1 2', netEur: 267.4, netR: 2.71, open: 0 });
    expect(summaryOf([...closed, { ticket: 3, slot: 'T3' as const, r: null, profit: null }]).trades).toBe('T1 -1.0 · T2 +3.7 · T3 …');
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
