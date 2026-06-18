import type { Candle } from '../indicators/ema';
import { detectEmaCrossSetups } from './ema-cross';
import type { EmaCrossContext, EmaCrossSetup } from './ema-cross';
import type { EntryConfig } from './entry-evaluator';

interface SetupForm {
  setup: EmaCrossContext & { type: string };
  entries: EntryConfig[];
}

export function evaluateSetups(candles: Candle[], form: SetupForm, pipSize: number): EmaCrossSetup[] {
  switch (form.setup.type) {
    case 'ema_cross':
      return detectEmaCrossSetups(candles, form.setup, pipSize);
    default:
      console.warn(`[SETUP-EVALUATOR] unknown setup type: ${form.setup.type}`);
      return [];
  }
}
