import { useEffect, useMemo, useState } from 'react';
import type { BacktestRun, BacktestSetup, BacktestTrade } from './backtest.types';
import styles from './ResultsPanel.module.css';

interface Props {
  run: BacktestRun | null;
  loading: boolean;
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

export function ResultsPanel({ run, loading }: Props) {
  const [selectedSetupId, setSelectedSetupId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSetupId(run?.setups[0]?.id ?? null);
  }, [run]);

  const summary = useMemo(() => {
    const trades = run?.setups.flatMap(s => s.trades) ?? [];
    const closed = trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => (t.resultPips ?? 0) > 0).length;
    return {
      setups: run?.setups.length ?? 0,
      trades: closed.length,
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      totalPips: closed.reduce((acc, t) => acc + (t.resultPips ?? 0), 0),
    };
  }, [run]);

  const selectedSetup = run?.setups.find(s => s.id === selectedSetupId) ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Backtest results</span>
        {run && <span className={styles.meta}>#{run.id} · {fmtTime(run.dateFrom)} → {fmtTime(run.dateTo)}</span>}
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
