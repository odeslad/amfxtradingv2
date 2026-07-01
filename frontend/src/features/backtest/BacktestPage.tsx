import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [previewRun, setPreviewRun] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  // EMA periods edited in the config panel — used for the PREVIEW chart.
  const [formEma, setFormEma] = useState<{ fast: number; slow: number }>({ fast: 12, slow: 26 });
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
    setPreviewRun(null);
    if (!selectedId) { setRun(null); return; }

    setLoading(true);
    void fetchRun(selectedId).then(r => { setRun(r); setLoading(false); });
  }, [selectedId, fetchRun]);

  // Poll until a run NEWER than prevCreatedAt appears (the freshly computed
  // one), so we never settle on the previous run while the new one is still
  // being written.
  const pollForRun = useCallback((id: number, prevCreatedAt: string | null) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries += 1;
      const r = await fetchRun(id);
      const isNew = r && r.createdAt !== prevCreatedAt;
      if (isNew || tries >= 20) {
        setRun(r);
        setRunning(false);
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 1500);
  }, [fetchRun]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const handleSaved = useCallback((saved: Strategy) => {
    const prevCreatedAt = run?.createdAt ?? null;
    setPreviewRun(null);
    void loadStrategies();
    setSelectedId(saved.id);
    setRunning(true);
    pollForRun(saved.id, prevCreatedAt);
  }, [loadStrategies, pollForRun, run]);

  const handlePreviewStart = useCallback(() => {
    setRunning(true);
  }, []);

  const handlePreview = useCallback((r: BacktestRun | null) => {
    if (r) setPreviewRun(r);
    setRunning(false);
  }, []);

  const handleDeleted = useCallback((id: number) => {
    void loadStrategies();
    setSelectedId(prev => (prev === id ? null : prev));
    setRun(null);
  }, [loadStrategies]);

  const handleEmaChange = useCallback((fast: number, slow: number) => {
    setFormEma(prev => (prev.fast === fast && prev.slow === slow ? prev : { fast, slow }));
  }, []);

  const { width, dragging, onHandleMouseDown } = useResizableWidth({
    min: 300, max: 720, initial: 360, storageKey: 'backtest.configWidth',
  });

  // EMA periods for the chart must match what the shown RUN was evaluated with:
  // a preview uses the edited form; a saved run uses its own strategy's config.
  const chartEma = useMemo(() => {
    if (previewRun) return formEma;
    const strat = strategies.find(s => s.id === run?.strategyId);
    const setup = strat?.config?.forms?.[0]?.setup;
    if (setup && typeof setup.emaFast === 'number' && typeof setup.emaSlow === 'number') {
      return { fast: setup.emaFast, slow: setup.emaSlow };
    }
    return formEma;
  }, [previewRun, run, strategies, formEma]);

  return (
    <div
      className={`${styles.page} ${dragging ? styles.dragging : ''}`}
      style={{ '--config-width': `${width}px` } as React.CSSProperties}
    >
      <div className={styles.config}>
        <ConfigPanel
          strategies={strategies}
          selectedId={selectedId}
          running={running}
          onSelect={setSelectedId}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onPreview={handlePreview}
          onPreviewStart={handlePreviewStart}
          onEmaChange={handleEmaChange}
        />
      </div>
      <div
        className={`${styles.handle} ${dragging ? styles.handleActive : ''}`}
        onMouseDown={onHandleMouseDown}
        role="separator"
        aria-orientation="vertical"
      />
      <div className={styles.results}>
        <ResultsPanel run={previewRun ?? run} loading={loading || running} isPreview={previewRun !== null} emaFast={chartEma.fast} emaSlow={chartEma.slow} />
      </div>
    </div>
  );
}
