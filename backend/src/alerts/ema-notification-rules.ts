// Pure decision logic of the EMA notifications (spec 023): what a candle close
// means for one rule and one symbol, and whether it should fire now given the
// last event and the repeat setting. No I/O, so it is unit-tested directly.

export type NotificationEvent = 'cross' | 'approach' | 'both';
export type NotificationDirection = 'buy' | 'sell' | 'both';
export type FireKind = 'cross' | 'approach';
export type FireDirection = 'buy' | 'sell';

export interface RuleLogic {
  event: NotificationEvent;
  direction: NotificationDirection;
  thresholdPips: number;
  repeatMinutes: number | null;   // null = once per event
}

export interface LastEvent {
  kind: FireKind;
  direction: FireDirection;
  candleTime: Date;
  firedAt: Date;
}

export interface Situation {
  kind: FireKind;
  direction: FireDirection;
}

export interface Decision {
  fire: Situation | null;
  // Whether an approach is "open" after this candle: inside the threshold and
  // converging. A once-per-event rule fires an approach only when it opens.
  approachOpen: boolean;
}

// What the two latest closed candles say. gap = fast − slow in pips.
export function detectSituation(gapNow: number, gapPrev: number, thresholdPips: number): Situation | null {
  const crossedUp = gapPrev <= 0 && gapNow > 0;
  const crossedDown = gapPrev >= 0 && gapNow < 0;
  if (crossedUp) return { kind: 'cross', direction: 'buy' };
  if (crossedDown) return { kind: 'cross', direction: 'sell' };
  const converging = Math.abs(gapNow) < Math.abs(gapPrev);
  if (converging && Math.abs(gapNow) <= thresholdPips && gapNow !== 0) {
    // Fast below slow and rising → bullish cross ahead; above and falling → bearish.
    return { kind: 'approach', direction: gapNow < 0 ? 'buy' : 'sell' };
  }
  return null;
}

const matchesEvent = (rule: RuleLogic, kind: FireKind): boolean =>
  rule.event === 'both' || rule.event === kind;

const matchesDirection = (rule: RuleLogic, direction: FireDirection): boolean =>
  rule.direction === 'both' || rule.direction === direction;

const minutesBetween = (a: Date, b: Date): number => (a.getTime() - b.getTime()) / 60_000;

// Decide for one rule and symbol at the close of the candle `candleTime`.
// `approachOpen` is the memory of the previous close (was an approach open?).
export function decideFire(
  rule: RuleLogic,
  gapNow: number,
  gapPrev: number,
  candleTime: Date,
  lastEvent: LastEvent | null,
  approachOpen: boolean,
  now: Date,
): Decision {
  const situation = detectSituation(gapNow, gapPrev, rule.thresholdPips);
  const openNow = situation?.kind === 'approach';

  if (!situation) return { fire: null, approachOpen: false };
  if (!matchesEvent(rule, situation.kind) || !matchesDirection(rule, situation.direction)) {
    return { fire: null, approachOpen: openNow };
  }

  if (situation.kind === 'cross') {
    // Once per crossing candle, whatever the repeat setting.
    const sameCandle = lastEvent?.kind === 'cross' && lastEvent.candleTime.getTime() === candleTime.getTime();
    return { fire: sameCandle ? null : situation, approachOpen: false };
  }

  // Approach.
  if (rule.repeatMinutes === null) {
    // Once per approach: fire when it opens (was not open at the previous close,
    // or the last thing notified was not this approach).
    const alreadyNotified = approachOpen && lastEvent?.kind === 'approach' && lastEvent.direction === situation.direction;
    return { fire: alreadyNotified ? null : situation, approachOpen: true };
  }
  const due = !lastEvent || minutesBetween(now, lastEvent.firedAt) >= rule.repeatMinutes;
  return { fire: due ? situation : null, approachOpen: true };
}
