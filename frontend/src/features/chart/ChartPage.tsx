import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { ChartToolbar } from './ChartToolbar';
import { LightweightChart } from './LightweightChart';
import { IndicatorsPanel } from './IndicatorsPanel';
import styles from './ChartPage.module.css';

interface RawCandle {
  openTime: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const TF_KEYS: Record<string, { time: string; open: string; high: string; low: string }> = {
  M5:  { time: 'm5_time',  open: 'm5_open',  high: 'm5_high',  low: 'm5_low'  },
  M15: { time: 'm15_time', open: 'm15_open', high: 'm15_high', low: 'm15_low' },
  H1:  { time: 'h1_time',  open: 'h1_open',  high: 'h1_high',  low: 'h1_low'  },
  H4:  { time: 'h4_time',  open: 'h4_open',  high: 'h4_high',  low: 'h4_low'  },
  D1:  { time: 'd1_time',  open: 'd1_open',  high: 'd1_high',  low: 'd1_low'  },
};

export function ChartPage() {
  const [brokers, setBrokers] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState('');
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('H1');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveCandle, setLiveCandle] = useState<Candle | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string }[]>)
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        if (list.length > 0) setBroker(list[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!broker) { setSymbols([]); setSymbol(''); return; }
    fetch(apiUrl(`/symbols?broker=${encodeURIComponent(broker)}`), { credentials: 'include' })
      .then(r => r.json() as Promise<string[]>)
      .then(list => {
        setSymbols(list);
        setSymbol(list.includes('EURUSD') ? 'EURUSD' : list[0] ?? '');
      })
      .catch(() => {});
  }, [broker]);

  useWs(useCallback((msg: unknown) => {
    const m = msg as { type: string; broker: string; ticks: Record<string, number>[] };
    if (m.type !== 'ticks' || m.broker !== broker) return;
    const keys = TF_KEYS[timeframe];
    if (!keys) return;
    const last = m.ticks.findLast((t) => t.symbol === symbol);
    if (!last) return;
    setLiveCandle({
      time: last[keys.time],
      open: last[keys.open],
      high: last[keys.high],
      low: last[keys.low],
      close: last.bid,
    });
  }, [broker, symbol, timeframe]));

  useEffect(() => {
    setLiveCandle(null);
  }, [broker, symbol, timeframe]);

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
        onIndicators={() => setIndicatorsOpen(true)}
      />
      <IndicatorsPanel open={indicatorsOpen} onClose={() => setIndicatorsOpen(false)} />
      <div className={styles.chartArea}>
        {broker && symbol
          ? <LightweightChart candles={candles} timeframe={timeframe} liveCandle={liveCandle} />
          : <div className={styles.empty}>Select a broker and symbol</div>
        }
      </div>
    </div>
  );
}
