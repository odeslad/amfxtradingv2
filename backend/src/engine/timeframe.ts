const TF_MINUTES: Record<string, number> = {
  M5: 5,
  M15: 15,
  H1: 60,
  H4: 240,
  D1: 1440,
};

export function getTimeframeMs(timeframe: string): number {
  const minutes = TF_MINUTES[timeframe.toUpperCase()] ?? 60;
  return minutes * 60 * 1000;
}
