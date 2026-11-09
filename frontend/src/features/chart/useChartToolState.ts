import { useLocalStorage } from '../../lib/useLocalStorage';
import type { PositionsMode } from './ChartToolbar';

export type ChartSide = 'left' | 'right';

type ToolKey = 'locked' | 'emaTrades' | 'positions';

// Per-side toolbar toggles remembered in the browser (spec 040). The lock and the EMA
// cross trades keep the keys they already had, so nothing saved before is lost.
const TOOL_KEYS: Record<ToolKey, Record<ChartSide, string>> = {
  locked: { left: 'chart.locked', right: 'chart.locked.right' },
  emaTrades: { left: 'chart.emaTrades', right: 'chart.emaTrades.right' },
  positions: { left: 'chart.positions', right: 'chart.positions.right' },
};

const POSITIONS_MODES: readonly PositionsMode[] = ['none', 'all', 'buys', 'sells'];

const isPositionsMode = (value: unknown): value is PositionsMode =>
  typeof value === 'string' && (POSITIONS_MODES as readonly string[]).includes(value);

export function useChartToolState(side: ChartSide) {
  const [locked, setLocked] = useLocalStorage<boolean>(TOOL_KEYS.locked[side], false);
  const [emaTradesOn, setEmaTradesOn] = useLocalStorage<boolean>(TOOL_KEYS.emaTrades[side], false);
  const [storedPositions, setPositionsMode] = useLocalStorage<PositionsMode>(TOOL_KEYS.positions[side], 'none');
  // A stored string outside the known modes passes JSON parsing; read it as the default.
  const positionsMode: PositionsMode = isPositionsMode(storedPositions) ? storedPositions : 'none';

  return {
    locked: locked === true,
    setLocked,
    emaTradesOn: emaTradesOn === true,
    setEmaTradesOn,
    positionsMode,
    setPositionsMode,
  };
}
