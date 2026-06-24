import { type Position, type PnlMode, fmtPnlMode } from '../journal/utils/position';

// Formats the P&L shown on a position's chart labels, honouring the user's
// pnlMode (net / gross / pips / %).
//
// - Entry label: the current P&L, exactly as the journal shows it.
// - SL / TP labels: the P&L the position would realise if closed at that price.
//   This is obtained by projecting the live position to the target price and
//   reusing the same formatter, so every mode (currency, pips, %) stays consistent.
//
// The projection derives the gross P&L at the target from the live position: the
// broker reports `profit` for the current exit price, so the gross value of one
// price unit is `profit / (currentExit - openPrice)`. Applying that to the target
// price yields the gross there; swap and commission are carried over unchanged.

const MIN_PRICE_MOVE = 1e-9;

function currentExitPrice(p: Position): number | null {
  const price = p.type === 0 ? p.currentBid : p.currentAsk;
  return price ?? null;
}

// A copy of the position as if its current exit price were `targetPrice`, so the
// shared formatter computes the projected P&L for any mode. Returns null when the
// projection can't be derived (no live price or no movement yet).
function projectToPrice(p: Position, targetPrice: number): Position | null {
  const exit = currentExitPrice(p);
  if (exit === null) return null;
  const dist = exit - p.openPrice;
  if (Math.abs(dist) < MIN_PRICE_MOVE) return null;

  const grossPerPrice = p.profit / dist;
  const projectedGross = grossPerPrice * (targetPrice - p.openPrice);

  return {
    ...p,
    profit: projectedGross,
    currentBid: p.type === 0 ? targetPrice : p.currentBid,
    currentAsk: p.type === 0 ? p.currentAsk : targetPrice,
  };
}

// Current P&L on the entry label, in the chosen mode.
export function formatEntryPnl(p: Position, mode: PnlMode, balance: number | undefined): string {
  return fmtPnlMode(p, mode, balance);
}

// Projected P&L at an SL/TP price, in the chosen mode. Empty string if it can't
// be derived (so the label simply omits it rather than showing a bogus value).
export function formatLevelPnl(p: Position, mode: PnlMode, balance: number | undefined, price: number): string {
  const projected = projectToPrice(p, price);
  if (!projected) return '';
  return fmtPnlMode(projected, mode, balance);
}
