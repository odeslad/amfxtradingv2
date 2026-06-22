import { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api';
import { ChartToolbar } from './ChartToolbar';
import { LightweightChart } from './LightweightChart';
import styles from './ChartPage.module.css';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface RawCandle {
  openTime: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function ChartPage() {
  const [brokers, setBrokers] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState('');
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('H1');
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string }[]>)
      .then(data => setBrokers(data.map(b => b.broker)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!broker) { setSymbols([]); setSymbol(''); return; }
    fetch(apiUrl(`/symbols?broker=${encodeURIComponent(broker)}`), { credentials: 'include' })
      .then(r => r.json() as Promise<string[]>)
      .then(list => { setSymbols(list); setSymbol(''); })
      .catch(() => {});
  }, [broker]);

  useEffect(() => {
    if (!broker || !symbol) { setCandles([]); return; }
    fetch(apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        const parsed = data.map(c => ({
          time: Math.floor(new Date(c.openTime).getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        parsed.sort((a, b) => a.time - b.time);
        setCandles(parsed);
      })
      .catch(() => {});
  }, [broker, symbol, timeframe]);

  return (
    <div className={styles.page}>
      <ChartToolbar
        brokers={brokers}
        symbols={symbols}
        broker={broker}
        symbol={symbol}
        timeframe={timeframe}
        onBrokerChange={setBroker}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
      />
      <div className={styles.chartArea}>
        {broker && symbol
          ? <LightweightChart candles={candles} />
          : <div className={styles.empty}>Select a broker and symbol</div>
        }
      </div>
    </div>
  );
}
