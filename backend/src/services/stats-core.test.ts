import { describe, it, expect } from 'vitest';
import { computeStats, type Movement } from './stats-core';

// Period: 2026-03-01 … 2026-05-31 (3 months). Latest balance 1 300 on 2026-06-10.
// Movements, ascending:
//   03-10 trade  +100
//   03-25 trade   -50
//   04-05 deposit +500   (cash flow)
//   04-20 trade  +200
//   05-15 trade   -30
//   06-05 trade   +80    (after the period, but before the anchor)
// Balance before 03-01 = 1300 − (100 − 50 + 500 + 200 − 30 + 80) = 500.
const at = (iso: string): Date => new Date(iso);
const trades: Movement[] = [
  { amount: 100, time: at('2026-03-10T10:00:00Z') },
  { amount: -50, time: at('2026-03-25T10:00:00Z') },
  { amount: 200, time: at('2026-04-20T10:00:00Z') },
  { amount: -30, time: at('2026-05-15T10:00:00Z') },
  { amount: 80, time: at('2026-06-05T10:00:00Z') },
];
const operations: Movement[] = [
  { amount: 500, time: at('2026-04-05T12:00:00Z'), comment: 'Deposit' },
];
const latest = { balance: 1300, currency: 'EUR', timestamp: at('2026-06-10T00:00:00Z') };
const from = at('2026-03-01T00:00:00Z');
const to = at('2026-05-31T23:59:59Z');

describe('computeStats', () => {
  const stats = computeStats({ broker: 'test', latest, trades, operations, from, to, now: at('2026-06-15T00:00:00Z') });

  it('counts only the trades inside the period and separates cash flow', () => {
    expect(stats.trades).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.netPnl).toBe(220);
    expect(stats.cashFlow).toBe(500);
    expect(stats.period).toEqual({ from: from.toISOString(), to: to.toISOString(), months: 3 });
    expect(stats.tradesPerMonth).toBeCloseTo(4 / 3, 10);
  });

  it('derives the start balance backwards from the latest snapshot', () => {
    expect(stats.startBalance).toBe(500);
    // return = 220 / (500 + 500) = 22 %
    expect(stats.returnPct).toBeCloseTo(22, 10);
  });

  it('builds one bucket per month with the balance at each month start as denominator', () => {
    expect(stats.monthly.map(m => m.month)).toEqual(['2026-03', '2026-04', '2026-05']);
    const [mar, apr, may] = stats.monthly;
    expect([mar.trades, mar.netPnl, mar.cashFlow]).toEqual([2, 50, 0]);
    expect(mar.returnPct).toBeCloseTo(50 / 500 * 100, 10);                 // balance before March = 500
    expect([apr.trades, apr.netPnl, apr.cashFlow]).toEqual([1, 200, 500]);
    expect(apr.returnPct).toBeCloseTo(200 / (550 + 500) * 100, 10);        // 550 before April + 500 deposit
    expect([may.trades, may.netPnl, may.cashFlow]).toEqual([1, -30, 0]);
    expect(may.returnPct).toBeCloseTo(-30 / 1250 * 100, 10);              // 1250 before May
  });

  it('draws a daily curve from the first trade with end-of-day balances and a baseline the day before', () => {
    expect(stats.curve).toHaveLength(84);                                  // baseline + Mar 22 + Apr 30 + May 31
    expect(stats.curve[0]).toEqual({ date: '2026-03-09', balance: 500 });
    expect(stats.curve.find(p => p.date === '2026-03-10')?.balance).toBe(600);
    expect(stats.curve.find(p => p.date === '2026-04-05')?.balance).toBe(1050);
    expect(stats.curve.at(-1)).toEqual({ date: '2026-05-31', balance: 1220 });
  });

  it('lists the period operations newest first', () => {
    expect(stats.operations).toEqual([{ time: '2026-04-05T12:00:00.000Z', amount: 500, comment: 'Deposit' }]);
  });

  it('without a snapshot the balance-based figures are null and the rest still computes', () => {
    const noAnchor = computeStats({ broker: 'test', latest: null, trades, operations, from, to });
    expect(noAnchor.startBalance).toBeNull();
    expect(noAnchor.returnPct).toBeNull();
    expect(noAnchor.currency).toBe('');
    expect(noAnchor.netPnl).toBe(220);
  });

  it('counts the winning trades of each month', () => {
    expect(stats.monthly.map(m => m.wins)).toEqual([1, 1, 0]);
  });

  it('in asset mode measures the return against the whole account', () => {
    // asset = the +100 and +200 trades; account = every trade and the deposit
    const assetTrades = [trades[0], trades[2]];
    const asset = computeStats({ broker: 'test', latest, trades: assetTrades, operations: [], from, to, mode: 'asset', accountTrades: trades, accountOperations: operations });
    expect(asset.netPnl).toBe(300);
    expect(asset.cashFlow).toBe(0);
    expect(asset.startBalance).toBe(500);
    expect(asset.returnPct).toBeCloseTo(300 / (500 + 500) * 100, 10);   // same denominator as the account
    const [mar, apr] = asset.monthly;
    expect(mar.returnPct).toBeCloseTo(100 / 500 * 100, 10);
    expect(apr.returnPct).toBeCloseTo(200 / (550 + 500) * 100, 10);
  });

  it('in asset mode without the account ignores operations, nulls the return and draws the cumulative P&L', () => {
    const asset = computeStats({ broker: 'test', latest, trades, operations, from, to, mode: 'asset' });
    expect(asset.netPnl).toBe(220);
    expect(asset.cashFlow).toBe(0);
    expect(asset.operations).toEqual([]);
    expect(asset.startBalance).toBeNull();
    expect(asset.returnPct).toBeNull();
    expect(asset.monthly.every(m => m.returnPct === null && m.cashFlow === 0)).toBe(true);
    expect(asset.curve[0]).toEqual({ date: '2026-03-09', balance: 0 });
    expect(asset.curve.find(p => p.date === '2026-03-10')?.balance).toBe(100);
    expect(asset.curve.find(p => p.date === '2026-04-20')?.balance).toBe(250);
    expect(asset.curve.at(-1)).toEqual({ date: '2026-05-31', balance: 220 });
  });

  it('starts the curve on the viewer\'s day when the period opens at local midnight', () => {
    const localMidnight = at('2026-03-14T23:00:00Z');                    // 15 March 00:00 in UTC+1
    const local = computeStats({ broker: 'test', latest, trades, operations, from: localMidnight, to });
    expect(local.curve[0]).toEqual({ date: '2026-03-14', balance: 600 });
    expect(local.curve[1].date).toBe('2026-03-15');
  });

  it('without a period starts on the day of the first trade even when it is in the evening', () => {
    const evening = [{ amount: 40, time: at('2026-03-10T20:00:00Z') }];
    const open = computeStats({ broker: 'test', latest: null, trades: evening, operations: [], mode: 'asset', now: at('2026-03-12T00:00:00Z') });
    expect(open.curve.map(p => p.date)).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12']);
    expect(open.curve.map(p => p.balance)).toEqual([0, 40, 40, 40]);
  });

  it('starts at the account start when the period reaches further back', () => {
    const early = computeStats({ broker: 'test', latest, trades, operations, from: at('2025-01-01T00:00:00Z'), to, accountStart: at('2026-03-10T10:00:00Z') });
    expect(early.period.from).toBe('2026-03-10T10:00:00.000Z');
    expect(early.curve[1].date).toBe('2026-03-10');
    expect(early.monthly.map(m => m.month)).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('without a period it starts at the first trade and ends now', () => {
    const open = computeStats({ broker: 'test', latest, trades, operations, now: at('2026-06-15T00:00:00Z') });
    expect(open.period.from).toBe(trades[0].time.toISOString());
    expect(open.period.to).toBeNull();
    expect(open.trades).toBe(5);
    expect(open.curve.at(-1)?.date).toBe('2026-06-15');
  });
});
