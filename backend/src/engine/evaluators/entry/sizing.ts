export interface SizingConfig {
  sizeMode: 'lots' | 'risk_pct';
  lots: number;
  riskPercent: number;
  compounding: boolean;
  sizingFilter?: {
    enabled: boolean;
    emaFast: number;
    emaSlow: number;
    timeframe: string;
    multiplier: number;
  };
}
