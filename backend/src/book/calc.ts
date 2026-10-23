// Pure arithmetic of the operator's book of schemes, exactly as the document
// computes it (verified on its 878 operations): the account starts at 10 000;
// one pip of one lot is worth 10 (account currency); the balance is chained in
// **close order** (an operation that closes later takes the balance left by the
// one that closed before it, whatever their tickets). R is the classic one:
// pips gained ÷ pips from the entry to the SL (1R = the SL distance). The lots
// the book proposes are 1 % of the current balance over the SL distance; the
// operator's own lots (kept on import, editable in the form) are what the € come from.

export const START_BALANCE = 10_000;
export const RISK = 0.01;
export const PIP = 0.0001;
export const PIP_VALUE = 10;

export type Slot = 'T1' | 'T2' | 'T3' | 'RE';
export type Direction = 'buy' | 'sell';
export type Result = Slot | 'Pierde' | 'Empate';
export type EffectiveResult = Result | 'Pendiente';
export const SLOTS: readonly Slot[] = ['T1', 'T2', 'T3', 'RE'];
export const RESULTS: readonly Result[] = ['T1', 'T2', 'T3', 'RE', 'Pierde', 'Empate'];

const WIN_R = 1.5;
const DRAW_BAND_R = 0.5;

export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const round2 = (v: number): number => Math.round(v * 100) / 100;

export const pips = (direction: Direction, from: number, to: number): number =>
  round1(((to - from) / PIP) * (direction === 'buy' ? 1 : -1));

export const slPips = (entry: number, sl: number): number => round1(Math.abs(entry - sl) / PIP);

// Lots proposed for a 1 % risk over the SL distance, rounded to 0.01.
export function lotsFor(riskBase: number, entry: number, sl: number): number {
  const stop = slPips(entry, sl) * PIP_VALUE;
  return stop > 0 ? round2((riskBase * RISK) / stop) : 0;
}

export interface TradeInput {
  direction: Direction;
  entry: number;
  sl: number;
  closePrice: number | null;
}

export interface Figures {
  lots: number;
  pips: number | null;
  profit: number | null;
  r: number | null;
}

// Lots (proposed unless given), pips, € and R of one operation against its risk
// base; an open operation (no close) has its lots and nothing else.
export function figuresFor(riskBase: number, input: TradeInput, lots = lotsFor(riskBase, input.entry, input.sl)): Figures {
  if (input.closePrice === null) return { lots, pips: null, profit: null, r: null };
  const gained = pips(input.direction, input.entry, input.closePrice);
  const profit = round2(lots * gained * PIP_VALUE);
  const stop = slPips(input.entry, input.sl);
  return { lots, pips: gained, profit, r: stop > 0 ? round2(gained / stop) : 0 };
}

export interface ChainTrade extends TradeInput {
  ticket: number;
  closeTime: Date | null;
  lots: number;
}

export interface Chained extends Figures {
  riskBase: number;
  balanceAfter: number | null;
}

// Every operation recomputed from its own lots, in close order: the risk base of
// an operation is the balance before its close, and its balance after follows.
// Open operations keep their lots; their risk base is the latest balance.
export function chain<T extends ChainTrade>(trades: T[], startBalance = START_BALANCE): (T & Chained)[] {
  const byTicket = [...trades].sort((a, b) => a.ticket - b.ticket);
  const closed = byTicket
    .filter(t => t.closePrice !== null && t.closeTime !== null)
    .sort((a, b) => (a.closeTime as Date).getTime() - (b.closeTime as Date).getTime() || a.ticket - b.ticket);

  const out = new Map<number, T & Chained>();
  let balance = startBalance;
  for (const t of closed) {
    const figures = figuresFor(balance, t, t.lots);
    const balanceAfter = round2(balance + (figures.profit as number));
    out.set(t.ticket, { ...t, ...figures, riskBase: balance, balanceAfter });
    balance = balanceAfter;
  }
  for (const t of byTicket) {
    if (out.has(t.ticket)) continue;
    out.set(t.ticket, { ...t, ...figuresFor(balance, t, t.lots), riskBase: balance, balanceAfter: null });
  }
  return byTicket.map(t => out.get(t.ticket) as T & Chained);
}

export interface SummaryTrade {
  ticket: number;
  slot: Slot;
  r: number | null;
  profit: number | null;
}

export interface Summary {
  tradesLine: string;
  tickets: string;
  netEur: number;
  netR: number;
  open: number;
}

const signed1 = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

// The document's "T1 -1.0 · T2 +3.7" line, tickets, and the net figures.
export function summaryOf(trades: SummaryTrade[]): Summary {
  const ordered = [...trades].sort((a, b) => a.ticket - b.ticket);
  return {
    tradesLine: ordered.map(t => `${t.slot} ${t.r === null ? '…' : signed1(t.r)}`).join(' · '),
    tickets: ordered.map(t => t.ticket).join(' '),
    netEur: round2(ordered.reduce((sum, t) => sum + (t.profit ?? 0), 0)),
    netR: round2(ordered.reduce((sum, t) => sum + (t.r ?? 0), 0)),
    open: ordered.filter(t => t.r === null).length,
  };
}

// The document's call in 449 of its 454 schemes: a draw inside ±0.5 R, else the
// last operation that reached its target, else a loss. Pending while the scheme
// has no end, no operations or an open one.
export function deriveResult(trades: SummaryTrade[], ended: boolean): EffectiveResult {
  if (!ended || trades.length === 0 || trades.some(t => t.r === null)) return 'Pendiente';
  const netR = trades.reduce((sum, t) => sum + (t.r ?? 0), 0);
  if (Math.abs(netR) < DRAW_BAND_R) return 'Empate';
  const winners = trades.filter(t => (t.r ?? 0) >= WIN_R);
  if (winners.length > 0) return winners[winners.length - 1].slot;
  if (netR > 0) return [...trades].sort((a, b) => (b.r ?? 0) - (a.r ?? 0))[0].slot;
  return 'Pierde';
}

export const effectiveResult = (stored: string, trades: SummaryTrade[], ended: boolean): EffectiveResult =>
  stored === 'auto' ? deriveResult(trades, ended) : (stored as Result);

export const isWon = (result: EffectiveResult): boolean => (SLOTS as readonly string[]).includes(result);

export interface Totals {
  schemes: number;
  won: number;
  draws: number;
  lost: number;
  pending: number;
  winPct: number;
  netEur: number;
  netR: number;
}

export function totalsOf(schemes: { result: EffectiveResult; netEur: number; netR: number }[]): Totals {
  const won = schemes.filter(s => isWon(s.result)).length;
  const draws = schemes.filter(s => s.result === 'Empate').length;
  const lost = schemes.filter(s => s.result === 'Pierde').length;
  const pending = schemes.filter(s => s.result === 'Pendiente').length;
  const decided = won + draws + lost;
  return {
    schemes: schemes.length,
    won, draws, lost, pending,
    winPct: decided > 0 ? Math.round((won / decided) * 100) : 0,
    netEur: round2(schemes.reduce((sum, s) => sum + s.netEur, 0)),
    netR: round2(schemes.reduce((sum, s) => sum + s.netR, 0)),
  };
}
