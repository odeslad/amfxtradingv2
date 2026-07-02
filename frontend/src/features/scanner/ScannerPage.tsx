import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../lib/api';
import { subscribe } from '../../lib/ws';
import { useScanner, type ScannerRow } from '../../lib/useScanner';
import styles from './ScannerPage.module.css';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d}d`;
}

function fmtWhen(row: ScannerRow): string {
  if (row.state === 'crossed') {
    return row.candlesSinceCross !== null ? `${row.candlesSinceCross}c ago` : 'crossed';
  }
  if (row.etaCandles === null) return '—';
  const candles = row.etaCandles < 1 ? '<1c' : `${Math.round(row.etaCandles)}c`;
  const time = row.etaMs !== null ? ` · ${fmtDuration(row.etaMs)}` : '';
  return `${candles}${time}`;
}

function fmtPips(n: number | null): string {
  if (n === null) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(1);
}

function liveDistancePips(row: ScannerRow, bid: number | undefined): number | null {
  if (row.state !== 'crossed' || row.activationClose === null || bid === undefined) return null;
  return (bid - row.activationClose) / row.pipSize;
}

function SituationTable({ title, rows, accent, onOpen, bids }: { title: string; rows: ScannerRow[]; accent: string; onOpen: (symbol: string) => void; bids: Record<string, number> }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader} style={{ color: accent }}>
        {title} <span className={styles.count}>{rows.length}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>State</th>
              <th>Gap</th>
              <th>Conv/c</th>
              <th>When</th>
              <th>Dist</th>
              <th>Last {5} crosses — MFE / MAE (pips)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>No symbols</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.symbol} className={styles.row} onDoubleClick={() => onOpen(r.symbol)} title="Double-click to open in chart">
                <td className={styles.symbol}>{r.symbol}</td>
                <td>
                  <span className={r.state === 'imminent' ? styles.badgeImminent : styles.badgeCrossed}>
                    {r.state === 'imminent' ? 'IMMINENT' : 'CROSSED'}
                  </span>
                </td>
                <td className={styles.mono}>{Math.abs(r.gapPips).toFixed(1)}p</td>
                <td className={styles.mono}>{r.convergencePips.toFixed(2)}</td>
                <td className={styles.mono}>{fmtWhen(r)}</td>
                <td className={styles.mono}>
                  {(() => {
                    const d = liveDistancePips(r, bids[r.symbol]);
                    if (d === null) return <span className={styles.muted}>—</span>;
                    return <span className={d >= 0 ? styles.crossMfe : styles.crossMae}>{(d > 0 ? '+' : '') + d.toFixed(1)}p</span>;
                  })()}
                </td>
                <td>
                  {r.lastCrosses.length === 0 ? (
                    <span className={styles.muted}>—</span>
                  ) : (
                    <div className={styles.crosses}>
                      {r.lastCrosses.map((c, i) => (
                        <div key={i} className={styles.cross}>
                          <span className={styles.crossMfe}>{fmtPips(c.mfePips)}</span>
                          <span className={styles.crossMae}>{fmtPips(c.maePips)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScannerPage() {
  const [brokers, setBrokers] = useState<string[]>([]);
  const [broker, setBroker] = useState('');
  const [timeframe, setTimeframe] = useState('H1');
  const [emaFast, setEmaFast] = useState('24');
  const [emaSlow, setEmaSlow] = useState('48');
  const [recentWithin, setRecentWithin] = useState('3');
  const [bids, setBids] = useState<Record<string, number>>({});
  const { result, loading, run } = useScanner();
  const navigate = useNavigate();

  // Live bids for the selected broker, to show real-time distance on crossed rows.
  useEffect(() => subscribe((data) => {
    const m = data as { type?: string; broker?: string; ticks?: { symbol: string; bid: number }[] };
    if (m.type !== 'ticks' || m.broker !== broker || !m.ticks) return;
    setBids(prev => {
      const next = { ...prev };
      for (const t of m.ticks!) next[t.symbol] = t.bid;
      return next;
    });
  }), [broker]);

  const openInChart = (symbol: string) => {
    navigate(`/chart?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
  };

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(r => r.json() as Promise<{ broker: string }[]>)
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        if (list.length > 0) setBroker(prev => prev || list[0]);
      })
      .catch(() => {});
  }, []);

  // Auto-scan on load and whenever a parameter changes. Debounced so editing the
  // EMA/N numbers doesn't fire a scan on every keystroke.
  useEffect(() => {
    const fast = parseInt(emaFast, 10);
    const slow = parseInt(emaSlow, 10);
    const recent = parseInt(recentWithin, 10);
    if (!broker || !Number.isInteger(fast) || !Number.isInteger(slow) || fast === slow) return;
    const id = setTimeout(() => {
      void run({ broker, timeframe, emaFast: fast, emaSlow: slow, recentWithin: Number.isInteger(recent) ? recent : 3 });
    }, 400);
    return () => clearTimeout(id);
  }, [broker, timeframe, emaFast, emaSlow, recentWithin, run]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.title}>Scanner</span>
        <select className={styles.input} value={broker} onChange={e => setBroker(e.target.value)}>
          {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
        </select>
        <select className={styles.input} value={timeframe} onChange={e => setTimeframe(e.target.value)}>
          {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={styles.inputNum} type="number" step="1" value={emaFast} onChange={e => setEmaFast(e.target.value)} title="EMA fast" />
        <input className={styles.inputNum} type="number" step="1" value={emaSlow} onChange={e => setEmaSlow(e.target.value)} title="EMA slow" />
        <input className={styles.inputNum} type="number" step="1" value={recentWithin} onChange={e => setRecentWithin(e.target.value)} title="Crossed within N candles" />
        <span className={styles.hint}>crossed ≤ N</span>
        {loading && <span className={styles.scanning}>Scanning…</span>}
      </div>

      <div className={styles.panels}>
        <SituationTable title="BUYS" rows={result.buys} accent="var(--green)" onOpen={openInChart} bids={bids} />
        <SituationTable title="SELLS" rows={result.sells} accent="var(--red)" onOpen={openInChart} bids={bids} />
      </div>
    </div>
  );
}
