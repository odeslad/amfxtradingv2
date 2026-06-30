import { useEffect, useMemo, useState } from 'react';
import type { BacktestRun, BacktestSetup, BacktestTrade } from './backtest.types';
import styles from './ResultsPanel.module.css';

interface Props {
  run: BacktestRun | null;
  loading: boolean;
  isPreview?: boolean;
}

const fmtPrice = (n: number | null) => (n === null ? '—' : n.toFixed(5));
const fmtPips = (n: number | null) => (n === null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1));
const fmtTime = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

function setupPips(setup: BacktestSetup): number {
  return setup.trades.reduce((acc, t) => acc + (t.status === 'closed' ? t.resultPips ?? 0 : 0), 0);
}

function statusClass(status: BacktestTrade['status'], pips: number | null) {
  if (status === 'open') return styles.statusOpen;
  if (status === 'missed') return styles.statusMissed;
  return (pips ?? 0) >= 0 ? styles.statusWin : styles.statusLoss;
}

export function ResultsPanel({ run, loading, isPreview = false }: Props) {
  const [selectedSetupId, setSelectedSetupId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSetupId(run?.setups[0]?.id ?? null);
  }, [run]);

  const summary = useMemo(() => {
    const trades = run?.setups.flatMap(s => s.trades) ?? [];
    const closed = trades.filter(t => t.status === 'closed');
    const open = trades.filter(t => t.status === 'open').length;
    const missed = trades.filter(t => t.status === 'missed').length;

    const pips = closed.map(t => t.resultPips ?? 0);
    const winsArr = pips.filter(p => p > 0);
    const lossesArr = pips.filter(p => p < 0);
    const grossWin = winsArr.reduce((a, p) => a + p, 0);
    const grossLoss = Math.abs(lossesArr.reduce((a, p) => a + p, 0));
    const totalPips = grossWin - grossLoss;

    const avgWin = winsArr.length ? grossWin / winsArr.length : 0;
    const avgLoss = lossesArr.length ? grossLoss / lossesArr.length : 0;

    // Max drawdown + longest losing streak over the equity curve (chronological).
    const chrono = [...closed].sort((a, b) => (a.exitTime ?? '').localeCompare(b.exitTime ?? ''));
    let equity = 0, peak = 0, maxDd = 0, streak = 0, maxStreak = 0;
    for (const t of chrono) {
      const p = t.resultPips ?? 0;
      equity += p;
      if (equity > peak) peak = equity;
      if (peak - equity > maxDd) maxDd = peak - equity;
      if (p < 0) { streak += 1; if (streak > maxStreak) maxStreak = streak; }
      else streak = 0;
    }

    return {
      setups: run?.setups.length ?? 0,
      trades: closed.length,
      open,
      missed,
      winRate: closed.length ? (winsArr.length / closed.length) * 100 : 0,
      totalPips,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
      expectancy: closed.length ? totalPips / closed.length : 0,
      avgWin,
      avgLoss,
      payoff: avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0),
      maxDrawdown: maxDd,
      maxLossStreak: maxStreak,
      best: pips.length ? Math.max(...pips) : 0,
      worst: pips.length ? Math.min(...pips) : 0,
    };
  }, [run]);

  const fmtRatio = (n: number) => (n === Infinity ? '∞' : n.toFixed(2));

  const selectedSetup = run?.setups.find(s => s.id === selectedSetupId) ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.titleGroup}>
          <span className={styles.title}>Backtest results</span>
          {isPreview && <span className={styles.previewBadge}>Preview (unsaved)</span>}
        </span>
        {run && (
          <span className={styles.meta}>
            {run.id !== undefined ? `#${run.id} · ` : ''}{fmtTime(run.dateFrom)} → {fmtTime(run.dateTo)}
          </span>
        )}
      </div>

      {loading && <div className={styles.empty}>Loading…</div>}
      {!loading && !run && <div className={styles.empty}>No backtest run yet. Save a strategy to run one.</div>}

      {!loading && run && (
        <>
          <div className={styles.summary}>
            <div className={styles.stat}><span className={styles.statLabel}>Setups</span><span className={styles.statValue}>{summary.setups}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Trades</span><span className={styles.statValue}>{summary.trades}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Win rate</span><span className={styles.statValue}>{summary.winRate.toFixed(0)}%</span></div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total pips</span>
              <span className={`${styles.statValue} ${summary.totalPips >= 0 ? styles.pos : styles.neg}`}>{fmtPips(summary.totalPips)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Profit factor</span>
              <span className={`${styles.statValue} ${summary.profitFactor >= 1 ? styles.pos : styles.neg}`}>{fmtRatio(summary.profitFactor)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Expectancy</span>
              <span className={`${styles.statValue} ${summary.expectancy >= 0 ? styles.pos : styles.neg}`}>{fmtPips(summary.expectancy)}</span>
            </div>
            <div className={styles.stat}><span className={styles.statLabel}>Avg win</span><span className={`${styles.statValue} ${styles.pos}`}>{fmtPips(summary.avgWin)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Avg loss</span><span className={`${styles.statValue} ${styles.neg}`}>{fmtPips(-summary.avgLoss)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Payoff</span><span className={styles.statValue}>{fmtRatio(summary.payoff)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Max DD</span><span className={`${styles.statValue} ${styles.neg}`}>{fmtPips(-summary.maxDrawdown)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Loss streak</span><span className={styles.statValue}>{summary.maxLossStreak}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Best</span><span className={`${styles.statValue} ${styles.pos}`}>{fmtPips(summary.best)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Worst</span><span className={`${styles.statValue} ${styles.neg}`}>{fmtPips(summary.worst)}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Open</span><span className={styles.statValue}>{summary.open}</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Missed</span><span className={styles.statValue}>{summary.missed}</span></div>
          </div>

          <div className={styles.master}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dir</th>
                  <th>Activation</th>
                  <th>Candles</th>
                  <th>ECC</th>
                  <th>EMA</th>
                  <th>EVL</th>
                  <th>MHL</th>
                  <th>Trades</th>
                  <th>Pips</th>
                </tr>
              </thead>
              <tbody>
                {run.setups.map(setup => {
                  const pips = setupPips(setup);
                  const selected = setup.id === selectedSetupId;
                  return (
                    <tr
                      key={setup.id}
                      className={`${styles.masterRow} ${selected ? styles.masterRowActive : ''} ${setup.direction === 'buy' ? styles.rowBuy : styles.rowSell}`}
                      onClick={() => setSelectedSetupId(setup.id)}
                    >
                      <td className={setup.direction === 'buy' ? styles.buy : styles.sell}>{setup.direction}</td>
                      <td>{fmtTime(setup.activationTime)}</td>
                      <td>{setup.candleCount}</td>
                      <td>{fmtPrice(setup.levels.ECC)}</td>
                      <td>{fmtPrice(setup.levels.EMA)}</td>
                      <td>{fmtPrice(setup.levels.EVL)}</td>
                      <td>{fmtPrice(setup.levels.MHL)}</td>
                      <td>{setup.trades.length}</td>
                      <td className={pips >= 0 ? styles.pos : styles.neg}>{fmtPips(pips)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.detailHeader}>
            {selectedSetup
              ? <>Entries · <span className={selectedSetup.direction === 'buy' ? styles.buy : styles.sell}>{selectedSetup.direction}</span> {fmtTime(selectedSetup.activationTime)}</>
              : 'Select a setup'}
          </div>

          <div className={styles.detail}>
            {selectedSetup && selectedSetup.trades.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Entry time</th>
                    <th>Price</th>
                    <th>SL</th>
                    <th>TP</th>
                    <th>Exit time</th>
                    <th>Exit</th>
                    <th>Pips</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSetup.trades.map(trade => (
                    <tr key={trade.id}>
                      <td>{trade.entryType}</td>
                      <td>{fmtTime(trade.entryTime)}</td>
                      <td>{fmtPrice(trade.entryPrice)}</td>
                      <td>{fmtPrice(trade.sl)}</td>
                      <td>{fmtPrice(trade.tp)}</td>
                      <td>{fmtTime(trade.exitTime)}</td>
                      <td>{fmtPrice(trade.exitPrice)}</td>
                      <td className={(trade.resultPips ?? 0) >= 0 ? styles.pos : styles.neg}>{fmtPips(trade.resultPips)}</td>
                      <td className={statusClass(trade.status, trade.resultPips)}>{trade.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.detailEmpty}>{selectedSetup ? 'No entries for this setup' : ''}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
