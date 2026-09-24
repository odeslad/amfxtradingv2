import { useRef, useState } from 'react';
import { fmt, currencySymbol } from './utils/position';
import styles from './JournalPage.module.css';
import accountStyles from './Accounts.module.css';

const DOUBLE_TAP_MS = 300;

const dayPnlClass = (value: number): string =>
  value === 0 ? styles.muted : value > 0 ? styles.profit : styles.loss;

interface Balance {
  broker: string;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  name: string;
  number: number;
}

interface AccountCardProps {
  balance: Balance;
  dayPnl?: number;
  onSelect?: () => void;
}

export function AccountCard({ balance: b, dayPnl, onSelect }: AccountCardProps) {
  const [expanded, setExpanded] = useState(false);
  const lastTapTime = useRef(0);

  // iOS Safari doesn't fire dblclick on double-tap, so detect it from clicks.
  const onSummaryClick = () => {
    const now = Date.now();
    if (onSelect && now - lastTapTime.current < DOUBLE_TAP_MS) {
      onSelect();
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;
    setExpanded(prev => !prev);
  };

  return (
    <div className={`${accountStyles.card} ${expanded ? accountStyles.cardExpanded : ''} ${dayPnl == null ? accountStyles.cardInactive : ''}`}>
      <button
        type="button"
        className={`${accountStyles.summary} ${expanded ? accountStyles.summaryActive : ''}`}
        onClick={onSummaryClick}
        onDoubleClick={onSelect}
        aria-expanded={expanded}
      >
        <span className={accountStyles.label}>Broker</span>
        <span className={accountStyles.label}>Number</span>
        <span className={`${accountStyles.label} ${accountStyles.right}`}>P&amp;L</span>

        <span className={accountStyles.accountName}>{b.broker}</span>
        <span className={accountStyles.accountName}>#{b.number}</span>
        <span className={`${b.profit >= 0 ? styles.profit : styles.loss} ${accountStyles.pnl} ${accountStyles.right}`}>
          {b.profit >= 0 ? '+' : ''}{fmt(b.profit, 2)} {currencySymbol(b.currency)}
        </span>
      </button>

      {expanded && (
        <div className={accountStyles.details}>
          <div className={accountStyles.field}>
            <span className={accountStyles.label}>Balance</span>
            <span className={accountStyles.fieldValue}>{fmt(b.balance, 2)} {currencySymbol(b.currency)}</span>
          </div>
          <div className={accountStyles.field}>
            <span className={accountStyles.label}>Equity</span>
            <span className={accountStyles.fieldValue}>{fmt(b.equity, 2)} {currencySymbol(b.currency)}</span>
          </div>
          <div className={accountStyles.field}>
            <span className={accountStyles.label}>Day P&amp;L</span>
            <span className={`${accountStyles.fieldValue} ${dayPnl != null ? dayPnlClass(dayPnl) : styles.muted}`}>
              {dayPnl != null ? `${dayPnl >= 0 ? '+' : ''}${fmt(dayPnl, 2)} ${currencySymbol(b.currency)}` : '—'}
            </span>
          </div>
          <div className={accountStyles.field}>
            <span className={accountStyles.label}>Margin</span>
            <span className={accountStyles.fieldValue}>{fmt(b.margin, 2)} {currencySymbol(b.currency)}</span>
          </div>
          <div className={accountStyles.field}>
            <span className={accountStyles.label}>Free Margin</span>
            <span className={accountStyles.fieldValue}>{fmt(b.freeMargin, 2)} {currencySymbol(b.currency)}</span>
          </div>
          <div className={accountStyles.fieldWide}>
            <span className={accountStyles.label}>Leverage</span>
            <span className={accountStyles.fieldValue}>1:{b.leverage}</span>
          </div>
          <div className={accountStyles.fieldWide}>
            <span className={accountStyles.label}>Currency</span>
            <span className={accountStyles.fieldValue}>{b.currency}</span>
          </div>
        </div>
      )}
    </div>
  );
}
