import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api';
import type { BacktestRun, Strategy } from './backtest.types';
import { ConfigPanel } from './ConfigPanel';
import { ResultsPanel } from './ResultsPanel';
import { useResizableWidth } from './useResizableWidth';
import styles from './BacktestPage.module.css';

export function BacktestPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/strategies'), { credentials: 'include' });
      setStrategies((await res.json()) as Strategy[]);
    } catch {
      setStrategies([]);
    }
  }, []);

  useEffect(() => { void loadStrategies(); }, [loadStrategies]);

  const fetchRun = useCallback(async (id: number): Promise<BacktestRun | null> => {
    const res = await fetch(apiUrl(`/strategies/${id}/backtest`), { credentials: 'include' });
    return (await res.json()) as BacktestRun | null;
  }, []);

  useEffect(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (!selectedId) { setRun(null); return; }

    setLoading(true);
    void fetchRun(selectedId).then(r => { setRun(r); setLoading(false); });
  }, [selectedId, fetchRun]);

  const pollForRun = useCallback((id: number) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries += 1;
      const r = await fetchRun(id);
      if (r || tries >= 10) {
        setRun(r);
        setLoading(false);
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 1500);
  }, [fetchRun]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const handleSaved = useCallback((saved: Strategy) => {
    void loadStrategies();
    setSelectedId(saved.id);
    setLoading(true);
    pollForRun(saved.id);
  }, [loadStrategies, pollForRun]);

  const handleDeleted = useCallback((id: number) => {
    void loadStrategies();
    setSelectedId(prev => (prev === id ? null : prev));
    setRun(null);
  }, [loadStrategies]);

  const { width, dragging, onHandleMouseDown } = useResizableWidth({
    min: 300, max: 720, initial: 360, storageKey: 'backtest.configWidth',
  });

  return (
    <div
      className={`${styles.page} ${dragging ? styles.dragging : ''}`}
      style={{ '--config-width': `${width}px` } as React.CSSProperties}
    >
      <div className={styles.config}>
        <ConfigPanel
          strategies={strategies}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </div>
      <div
        className={`${styles.handle} ${dragging ? styles.handleActive : ''}`}
        onMouseDown={onHandleMouseDown}
        role="separator"
        aria-orientation="vertical"
      />
      <div className={styles.results}>
        <ResultsPanel run={run} loading={loading} />
      </div>
    </div>
  );
}
