import { describe, it, expect } from 'vitest';
import { decideFire, detectSituation, type LastEvent, type RuleLogic } from './ema-notification-rules';

const at = (s: string): Date => new Date(s + ':00Z');
const rule = (over: Partial<RuleLogic> = {}): RuleLogic =>
  ({ event: 'both', direction: 'both', thresholdPips: 3, repeatMinutes: null, ...over });

describe('detectSituation', () => {
  it('sees a bullish cross when the gap turns positive and a bearish one when it turns negative', () => {
    expect(detectSituation(0.4, -1.2, 3)).toEqual({ kind: 'cross', direction: 'buy' });
    expect(detectSituation(-0.1, 2.0, 3)).toEqual({ kind: 'cross', direction: 'sell' });
    expect(detectSituation(0.5, 0, 3)).toEqual({ kind: 'cross', direction: 'buy' });
  });

  it('sees an approach only while converging inside the threshold', () => {
    expect(detectSituation(-2.5, -4.0, 3)).toEqual({ kind: 'approach', direction: 'buy' });
    expect(detectSituation(2.9, 3.5, 3)).toEqual({ kind: 'approach', direction: 'sell' });
    expect(detectSituation(-3.5, -4.0, 3)).toBeNull();   // outside the threshold
    expect(detectSituation(-2.5, -2.0, 3)).toBeNull();   // diverging
    expect(detectSituation(-2.5, -2.5, 3)).toBeNull();   // flat
  });
});

describe('decideFire', () => {
  const t1 = at('2026-10-23T10:00');
  const t2 = at('2026-10-23T11:00');

  it('fires a cross once per crossing candle, whatever the repeat', () => {
    const r = rule({ repeatMinutes: 5 });
    const first = decideFire(r, 0.4, -1.2, t1, null, false, t1);
    expect(first.fire).toEqual({ kind: 'cross', direction: 'buy' });
    const last: LastEvent = { kind: 'cross', direction: 'buy', candleTime: t1, firedAt: t1 };
    expect(decideFire(r, 0.4, -1.2, t1, last, false, at('2026-10-23T10:30')).fire).toBeNull();
    expect(decideFire(r, -0.2, 0.4, t2, last, false, t2).fire).toEqual({ kind: 'cross', direction: 'sell' });
  });

  it('applies the direction and event filters', () => {
    expect(decideFire(rule({ direction: 'sell' }), 0.4, -1.2, t1, null, false, t1).fire).toBeNull();
    expect(decideFire(rule({ event: 'cross' }), -2.5, -4.0, t1, null, false, t1).fire).toBeNull();
    expect(decideFire(rule({ event: 'approach' }), 0.4, -1.2, t1, null, false, t1).fire).toBeNull();
    expect(decideFire(rule({ event: 'approach', direction: 'buy' }), -2.5, -4.0, t1, null, false, t1).fire)
      .toEqual({ kind: 'approach', direction: 'buy' });
  });

  it('fires a once-per-event approach when it opens and stays quiet while it is open', () => {
    const r = rule();
    const opened = decideFire(r, -2.5, -4.0, t1, null, false, t1);
    expect(opened.fire).toEqual({ kind: 'approach', direction: 'buy' });
    expect(opened.approachOpen).toBe(true);
    const last: LastEvent = { kind: 'approach', direction: 'buy', candleTime: t1, firedAt: t1 };
    const still = decideFire(r, -1.8, -2.5, t2, last, true, t2);
    expect(still.fire).toBeNull();
    expect(still.approachOpen).toBe(true);
    // The gap widens past the threshold: the approach closes…
    const closed = decideFire(r, -4.5, -1.8, at('2026-10-23T12:00'), last, true, at('2026-10-23T12:00'));
    expect(closed.fire).toBeNull();
    expect(closed.approachOpen).toBe(false);
    // …and a new approach fires again.
    expect(decideFire(r, -2.0, -4.5, at('2026-10-23T13:00'), last, false, at('2026-10-23T13:00')).fire)
      .toEqual({ kind: 'approach', direction: 'buy' });
  });

  it('repeats an open approach every N minutes', () => {
    const r = rule({ repeatMinutes: 30 });
    const last: LastEvent = { kind: 'approach', direction: 'buy', candleTime: t1, firedAt: t1 };
    expect(decideFire(r, -1.8, -2.5, at('2026-10-23T10:15'), last, true, at('2026-10-23T10:15')).fire).toBeNull();
    expect(decideFire(r, -1.5, -1.8, at('2026-10-23T10:30'), last, true, at('2026-10-23T10:30')).fire)
      .toEqual({ kind: 'approach', direction: 'buy' });
  });

  it('closes an approach and fires the cross when the EMAs finally cross', () => {
    const last: LastEvent = { kind: 'approach', direction: 'buy', candleTime: t1, firedAt: t1 };
    const d = decideFire(rule(), 0.3, -0.8, t2, last, true, t2);
    expect(d.fire).toEqual({ kind: 'cross', direction: 'buy' });
    expect(d.approachOpen).toBe(false);
  });
});
