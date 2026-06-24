import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { ChartToolbar } from './ChartToolbar';
import { ChartFiltersPanel } from './ChartFiltersPanel';
import { LightweightChart } from './LightweightChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useLocalStorage } from '../../lib/useLocalStorage';
import type { PersistedDrawing, TrendlineAppearance } from './DrawingTools';
import type { DrawMode } from './LightweightChart';
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
  // URL query params take precedence (deep links from the journal/legend);
  // otherwise fall back to the last selection persisted in localStorage.
  const [stored, setStored] = useLocalStorage('chart.selection', { broker: '', symbol: '', timeframe: 'H1' });
  const initBroker = searchParams.get('broker') ?? stored.broker;
  const initSymbol = searchParams.get('symbol') ?? stored.symbol;
  const initTimeframe = searchParams.get('timeframe') ?? stored.timeframe;

  const [brokers, setBrokers] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState(initBroker);
  const [symbol, setSymbol] = useState(initSymbol);
  const [timeframe, setTimeframe] = useState(initTimeframe);

  // Persist the current selection whenever it changes.
  useEffect(() => {
    setStored({ broker, symbol, timeframe });
  }, [broker, symbol, timeframe, setStored]);

  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveCandle, setLiveCandle] = useState<Candle | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [positionsVisible, setPositionsVisible] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [drawings, setDrawings] = useState<PersistedDrawing[] | null>(null);
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

  // iOS Safari (iPhone) has no Fullscreen API for arbitrary elements, so keep our
  // own state and fall back to a CSS fullscreen when the native API is missing.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenEnabled) setIsFullscreen(document.fullscreenElement === pageRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const nativeFullscreen = typeof document !== 'undefined'
    && document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function';

  const toggleFullscreen = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const canNative = document.fullscreenEnabled && typeof el.requestFullscreen === 'function';
    if (canNative) {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen();
    } else {
      // CSS fullscreen fallback for iPhone
      setIsFullscreen(prev => !prev);
    }
  }, []);

  // CSS fallback (iPhone): hide the app chrome (topbar + bottom nav) while
  // fullscreen, since `position: fixed` alone is unreliable inside Safari iOS.
  useEffect(() => {
    if (nativeFullscreen) return;
    document.body.classList.toggle('chartFullscreenActive', isFullscreen);
    return () => document.body.classList.remove('chartFullscreenActive');
  }, [isFullscreen, nativeFullscreen]);

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

  const [balances, setBalances] = useState<Record<string, number>>({});
  const { pnlMode } = useDisplaySettings();

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string; balance: number }[]>)
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        setBalances(Object.fromEntries(data.map(b => [b.broker, b.balance])));
        // pick the first broker if none is selected or the stored one is gone
        if (list.length > 0 && !list.includes(broker)) setBroker(list[0]);
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
      currency?: string;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      positions?: Position[];
    };
    if (m.broker !== broker) return;

    if (m.type === 'positions') {
      setPositions((m.positions ?? []).map(p => ({
        ...p,
        broker: p.broker ?? m.broker,
        brokerOffset: p.brokerOffset ?? m.brokerOffset,
        currency: p.currency ?? m.currency,
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
      .then(res => res.ok ? res.json() as Promise<{ broker: string; brokerOffset?: number; currency?: string; positions: Position[] }[]> : Promise.resolve([]))
      .then(brokers => {
        const entry = brokers.find(b => b.broker === broker);
        setPositions((entry?.positions ?? []).map(p => ({
          ...p,
          broker: p.broker ?? broker,
          brokerOffset: p.brokerOffset ?? entry?.brokerOffset,
          currency: p.currency ?? entry?.currency,
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
    setDrawings(null);
    if (!broker || !symbol) return;
    const params = new URLSearchParams({ broker, symbol, timeframe });
    fetch(apiUrl(`/drawings?${params.toString()}`), { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ items: PersistedDrawing[] }> : Promise.resolve({ items: [] }))
      .then(data => setDrawings(data.items ?? []))
      .catch(() => setDrawings([]));
  }, [broker, symbol, timeframe]);

  const saveDrawings = useCallback((items: PersistedDrawing[]) => {
    if (!broker || !symbol) return;
    fetch(apiUrl('/drawings'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker, symbol, timeframe, items }),
    }).catch(() => {});
  }, [broker, symbol, timeframe]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDrawingsChange = useCallback((items: PersistedDrawing[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDrawings(items), 600);
  }, [saveDrawings]);

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
    <div className={`${styles.page} ${isFullscreen ? styles.pageFullscreen : ''}`} ref={pageRef}>
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
        drawMode={drawMode}
        onDrawMode={mode => setDrawMode(prev => (prev === mode ? null : mode))}
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
          ? <ChartErrorBoundary resetKey={`${broker}-${symbol}-${timeframe}`}>
              <LightweightChart candles={candles} broker={broker} symbol={symbol} timeframe={timeframe} liveCandle={liveCandle} onLoadMore={hasMore ? loadMoreCandles : undefined} emas={emas} drawMode={drawMode} onDrawDone={() => setDrawMode(null)} positions={chartPositions} onEditPosition={handleEditPosition} onModifyPosition={handleModifyPosition} initialDrawings={drawings ?? undefined} onDrawingsChange={handleDrawingsChange} trendlineAppearance={trendlineAppearance} accountBalance={balances[broker]} pnlMode={pnlMode} />
            </ChartErrorBoundary>
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
