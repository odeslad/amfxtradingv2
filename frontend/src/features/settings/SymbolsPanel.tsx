import { useState } from 'react';
import styles from '../journal/BulkEditPanel.module.css';
import own from './SymbolsPanel.module.css';

interface SymbolsPanelProps {
  open: boolean;
  broker: string | null;
  symbols: string[];
  hidden: string[];
  onChange: (broker: string, hidden: string[]) => void;
  onClose: () => void;
}

export function SymbolsPanel({ open, broker, symbols, hidden, onChange, onClose }: SymbolsPanelProps) {
  const [query, setQuery] = useState('');

  const close = () => { setQuery(''); onClose(); };

  const term = query.trim().toUpperCase();
  const shown = term ? symbols.filter(s => s.includes(term)) : symbols;
  const hiddenSet = new Set(hidden);

  const toggle = (symbol: string) => {
    if (!broker) return;
    onChange(broker, hiddenSet.has(symbol) ? hidden.filter(s => s !== symbol) : [...hidden, symbol]);
  };

  const showAll = () => { if (broker) onChange(broker, hidden.filter(s => !shown.includes(s))); };
  const hideAll = () => { if (broker) onChange(broker, Array.from(new Set([...hidden, ...shown]))); };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={close} />}
      <div className={`${styles.panel} ${own.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Symbols · {broker ?? ''}</div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">✕</button>
        </div>

        <div className={own.body}>
          <input
            className={styles.input}
            type="text"
            placeholder="Search symbol"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search symbol"
          />

          <div className={own.toolbar}>
            <span className={own.count}>{symbols.length} symbols · {hidden.length} hidden</span>
            <span className={own.toolbarBtns}>
              <button type="button" className={own.smBtn} onClick={showAll}>Show all</button>
              <button type="button" className={own.smBtn} onClick={hideAll}>Hide all</button>
            </span>
          </div>

          <div className={own.list}>
            {shown.length === 0 && <span className={own.empty}>No symbol matches</span>}
            {shown.map(symbol => {
              const isHidden = hiddenSet.has(symbol);
              return (
                <label key={symbol} className={own.item}>
                  <input type="checkbox" checked={!isHidden} onChange={() => toggle(symbol)} aria-label={`Show ${symbol}`} />
                  <span className={`${own.box} ${isHidden ? '' : own.boxOn}`} aria-hidden="true">{isHidden ? '' : '✓'}</span>
                  <span className={isHidden ? own.nameHidden : own.name}>{symbol}</span>
                  <span className={`${own.state} ${isHidden ? own.stateHidden : ''}`}>{isHidden ? 'hidden' : 'visible'}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
