import { useState } from 'react';
import { type Trade, fmt, fmtPnl, fmtLocalTime } from './utils/position';
import styles from './JournalPage.module.css';
import tradeStyles from './TradeCard.module.css';

interface TradeCardProps {
  trade: Trade;
}

export function TradeCard({ trade: t }: TradeCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${tradeStyles.card} ${expanded ? tradeStyles.cardExpanded : ''}`}>
      <button
        type="button"
        className={`${tradeStyles.summary} ${expanded ? tradeStyles.summaryActive : ''}`}
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <span className={tradeStyles.label}>Symbol</span>
        <span className={tradeStyles.label}>Close Price</span>
        <span className={`${tradeStyles.label} ${tradeStyles.right}`}>P&amp;L</span>

        <span className={t.type === 0 ? styles.buy : styles.sell}>{t.symbol}</span>
        <span className={tradeStyles.value}>{fmt(t.closePrice, 5)}</span>
        <span className={`${t.profit >= 0 ? styles.profit : styles.loss} ${tradeStyles.right} ${tradeStyles.pnl}`}>
          {fmtPnl(t.profit)}
        </span>
      </button>

      {expanded && (
        <div className={tradeStyles.details}>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Open Price</span>
            <span>{fmt(t.openPrice, 5)}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Lots</span>
            <span>{fmt(t.lots, 2)}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>SL</span>
            <span>{t.sl ? fmt(t.sl, 5) : '—'}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>TP</span>
            <span>{t.tp ? fmt(t.tp, 5) : '—'}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Swap</span>
            <span className={t.swap < 0 ? styles.loss : undefined}>
              {fmt(t.swap, 2)}
            </span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Commission</span>
            <span className={t.commission < 0 ? styles.loss : styles.muted}>
              {fmt(t.commission, 2)}
            </span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Broker</span>
            <span className={tradeStyles.brokerName}>{t.broker}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Open Time</span>
            <span className={tradeStyles.date}>{fmtLocalTime(t.openTime)}</span>
          </div>
          <div className={tradeStyles.field}>
            <span className={tradeStyles.label}>Close Time</span>
            <span className={tradeStyles.date}>{fmtLocalTime(t.closeTime)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
