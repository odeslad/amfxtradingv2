export function calculateLots(
  balance: number,
  riskPct: number,
  slPrice: number,
  currentBid: number,
  symbol: string,
  accountCurrency: string,
  allBids: Map<string, number>,
): number {
  const sym = symbol.toUpperCase();
  const pipSize = sym.includes('JPY') ? 0.01 : 0.0001;
  const contractSize = 100_000;

  const slPips = Math.abs(currentBid - slPrice) / pipSize;
  if (slPips === 0) return 0.01;

  const quoteCurrency = sym.slice(-3);
  const pipValuePerLot = resolvePipValue(pipSize, contractSize, quoteCurrency, accountCurrency, allBids);

  const lots = (balance * riskPct / 100) / (slPips * pipValuePerLot);
  return Math.max(0.01, Math.round(lots * 100) / 100);
}

function resolvePipValue(
  pipSize: number,
  contractSize: number,
  quoteCurrency: string,
  accountCurrency: string,
  bids: Map<string, number>,
): number {
  const base = pipSize * contractSize;

  if (quoteCurrency === accountCurrency) return base;

  const direct = `${quoteCurrency}${accountCurrency}`;
  const inverse = `${accountCurrency}${quoteCurrency}`;

  if (bids.has(direct)) return base * bids.get(direct)!;
  if (bids.has(inverse)) return base / bids.get(inverse)!;

  return base;
}
