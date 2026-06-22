export interface Ema {
  id: string;
  period: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: 1 | 2 | 3;
}
