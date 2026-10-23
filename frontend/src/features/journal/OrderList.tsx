import { type Position, fmt, fmtDistance, isBuySide, orderDistancePips, TYPE_LABEL } from './utils/position';
import styles from './OrderList.module.css';

interface OrderListProps {
  orders: Position[];   // one or more orders sharing symbol and type
}

// The head ("Buy Limit EURUSD" + broker) and one row per order (price, lots,
// distance) shown by the order panels before their fields or buttons.
export function OrderList({ orders }: OrderListProps) {
  const first = orders[0];
  if (!first) return null;
  const brokers = [...new Set(orders.map(p => p.broker ?? ''))];
  const oneBroker = brokers.length === 1;

  return (
    <>
      <div className={styles.head}>
        <span className={`${styles.kind} ${isBuySide(first.type) ? styles.buy : styles.sell}`}>{TYPE_LABEL[first.type]} {first.symbol}</span>
        {oneBroker && <span className={styles.broker}>{brokers[0]}</span>}
      </div>
      <div className={styles.list}>
        <div className={styles.labels}>
          <span className={styles.label}>Price</span>
          <span className={styles.label}>Lots</span>
          <span className={`${styles.label} ${styles.right}`}>Distance</span>
        </div>
        {orders.map(p => {
          const distance = orderDistancePips(p);
          return (
            <div key={`${p.broker}-${p.ticket}`} className={styles.row}>
              <span className={styles.price}>
                {fmt(p.openPrice, 5)}
                {!oneBroker && <span className={styles.rowBroker}>{p.broker}</span>}
              </span>
              <span>{fmt(p.lots, 2)}</span>
              <span className={`${styles.distance} ${distance === null ? styles.muted : distance >= 0 ? styles.profit : styles.loss}`}>{fmtDistance(distance)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
