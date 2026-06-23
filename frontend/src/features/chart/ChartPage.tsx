import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { ChartToolbar } from './ChartToolbar';
import { ChartFiltersPanel } from './ChartFiltersPanel';
import { LightweightChart } from './LightweightChart';
import type { PersistedTrendline, TrendlineAppearance } from './TrendlineTools';
import { IndicatorsPanel } from './IndicatorsPanel';
import { BulkEditPanel } from '../journal/BulkEditPanel';
import type { Ema } from './chart.types';
import type { Position } from '../journal/utils/position';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initBroker = searchParams.get('broker') ?? '';
  const initSymbol = searchParams.get('symbol') ?? '';
  const initTimeframe = searchParams.get('timeframe') ?? 'H1';

  const [brokers, setBrokers] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState(initBroker);
  const [symbol, setSymbol] = useState(initSymbol);
  const [timeframe, setTimeframe] = useState(initTimeframe);

  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveCandle, setLiveCandle] = useState<Candle | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trendlineActive, setTrendlineActive] = useState(false);
  const [positionsVisible, setPositionsVisible] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [trendlines, setTrendlines] = useState<PersistedTrendline[] | null>(null);
  const [trendlineAppearance, setTrendlineAppearance] = useState<TrendlineAppearance>({ color: '#8c8c8c', style: 'dashed', width: 1 });
  const [hasMore, setHasMore] = useState(true);
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const [emas, setEmas] = useState<Ema[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>([]);
  const emasRef = useRef<Ema[]>([]);

  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { emasRef.current = emas; }, [emas]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === pageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      pageRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    fetch(apiUrl('/chart-indicators'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ emas: Ema[] }>)
      .then(data => setEmas(data.emas ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(apiUrl('/settings'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ display: { trendlineColor?: string; trendlineStyle?: string; trendlineWidth?: number } }>)
      .then(data => {
        const color = data.display?.trendlineColor;
        const style = data.display?.trendlineStyle;
        const width = data.display?.trendlineWidth;
        if (color || style || width) {
          setTrendlineAppearance(prev => ({
            color: color ?? prev.color,
            style: (style as TrendlineAppearance['style']) ?? prev.style,
            width: width ?? prev.width,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const saveEmas = useCallback(async () => {
    await fetch(apiUrl('/chart-indicators'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emas: emasRef.current }),
    });
  }, []);

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string }[]>)
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        if (!initBroker && list.length > 0) setBroker(list[0]);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!broker) { setSymbols([]); setSymbol(''); return; }
    fetch(apiUrl(`/symbols?broker=${encodeURIComponent(broker)}`), { credentials: 'include' })
      .then(r => r.json() as Promise<string[]>)
      .then(list => {
        setSymbols(list);
        if (!initSymbol) setSymbol(list.includes('EURUSD') ? 'EURUSD' : list[0] ?? '');
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broker]);

  useWs(useCallback((msg: unknown) => {
    const m = msg as {
      type: string;
      broker: string;
      brokerOffset?: number;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      positions?: Position[];
    };
    if (m.broker !== broker) return;

    if (m.type === 'positions') {
      setPositions((m.positions ?? []).map(p => ({
        ...p,
        broker: p.broker ?? m.broker,
        brokerOffset: p.brokerOffset ?? m.brokerOffset,
      })));
      return;
    }

    if (m.type !== 'ticks' || !m.ticks) return;
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
    if (!positionsVisible || !broker) { setPositions([]); return; }
    fetch(apiUrl('/positions/live'), { credentials: 'include' })
      .then(res => res.ok ? res.json() as Promise<{ broker: string; brokerOffset?: number; positions: Position[] }[]> : Promise.resolve([]))
      .then(brokers => {
        const entry = brokers.find(b => b.broker === broker);
        setPositions((entry?.positions ?? []).map(p => ({
          ...p,
          broker: p.broker ?? broker,
          brokerOffset: p.brokerOffset ?? entry?.brokerOffset,
        })));
      })
      .catch(() => {});
  }, [positionsVisible, broker]);

  useEffect(() => {
    if (!broker || !symbol) { setCandles([]); return; }
    setCandles([]);
    setHasMore(true);
    hasMoreRef.current = true;
    fetch(apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=2000`), { credentials: 'include' })
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

  useEffect(() => {
    setTrendlines(null);
    if (!broker || !symbol) return;
    const params = new URLSearchParams({ broker, symbol, timeframe });
    fetch(apiUrl(`/trendlines?${params.toString()}`), { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ lines: PersistedTrendline[] }> : Promise.resolve({ lines: [] }))
      .then(data => setTrendlines(data.lines ?? []))
      .catch(() => setTrendlines([]));
  }, [broker, symbol, timeframe]);

  const saveTrendlines = useCallback((lines: PersistedTrendline[]) => {
    if (!broker || !symbol) return;
    fetch(apiUrl('/trendlines'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker, symbol, timeframe, lines }),
    }).catch(() => {});
  }, [broker, symbol, timeframe]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTrendlinesChange = useCallback((lines: PersistedTrendline[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveTrendlines(lines), 600);
  }, [saveTrendlines]);

  const loadMoreCandles = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !broker || !symbol) return;
    const oldest = candlesRef.current[0]?.time;
    if (!oldest) return;
    isLoadingMoreRef.current = true;
    fetch(apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=500&before=${oldest}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        if (data.length === 0) { hasMoreRef.current = false; setHasMore(false); return; }
        const parsed = data.map(c => ({
          time: Math.floor(new Date(c.openTime).getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        parsed.sort((a, b) => a.time - b.time);
        setCandles(prev => [...parsed, ...prev]);
      })
      .catch(() => {})
      .finally(() => { isLoadingMoreRef.current = false; });
  }, [broker, symbol, timeframe]);

  const chartPositions = useMemo(
    () => (positionsVisible ? positions.filter(p => p.symbol === symbol) : []),
    [positionsVisible, positions, symbol],
  );

  const handleEditPosition = useCallback((ticket: number) => {
    const pos = positions.find(p => p.ticket === ticket);
    if (pos) setEditPosition(pos);
  }, [positions]);

  const handleModifyPosition = useCallback((ticket: number, sl: number, tp: number) => {
    const pos = positions.find(p => p.ticket === ticket);
    if (!pos) return;
    fetch(apiUrl('/commands'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        action: 'modify',
        broker: pos.broker,
        symbol: pos.symbol,
        ticket: pos.ticket,
        lots: pos.lots,
        sl,
        tp,
      }),
    }).catch(() => {});
  }, [positions]);

  return (
    <div className={styles.page} ref={pageRef}>
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
        onFilters={() => setFiltersOpen(true)}
        onTrendline={() => setTrendlineActive(prev => !prev)}
        trendlineActive={trendlineActive}
        onPositions={() => setPositionsVisible(prev => !prev)}
        positionsActive={positionsVisible}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
      <ChartFiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        brokers={brokers}
        symbols={symbols}
        broker={broker}
        symbol={symbol}
        onBrokerChange={setBroker}
        onSymbolChange={setSymbol}
      />
      <IndicatorsPanel
        open={indicatorsOpen}
        onClose={() => setIndicatorsOpen(false)}
        emas={emas}
        onEmasChange={setEmas}
        onSave={saveEmas}
      />
      <div className={styles.chartArea}>
        {broker && symbol
          ? <LightweightChart candles={candles} broker={broker} symbol={symbol} timeframe={timeframe} liveCandle={liveCandle} onLoadMore={hasMore ? loadMoreCandles : undefined} emas={emas} trendlineActive={trendlineActive} onTrendlineDone={() => setTrendlineActive(false)} positions={chartPositions} onEditPosition={handleEditPosition} onModifyPosition={handleModifyPosition} initialTrendlines={trendlines ?? undefined} onTrendlinesChange={handleTrendlinesChange} trendlineAppearance={trendlineAppearance} />
          : <div className={styles.empty}>Select a broker and symbol</div>
        }
      </div>

      <BulkEditPanel
        open={!!editPosition}
        positions={editPosition ? [editPosition] : []}
        onClose={() => setEditPosition(null)}
      />
    </div>
  );
}
