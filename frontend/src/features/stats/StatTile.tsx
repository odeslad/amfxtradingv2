import styles from './StatTile.module.css';

export type StatTone = 'positive' | 'negative' | 'neutral';

interface StatTileProps {
  label: string;
  value: string;
  tone?: StatTone;
  hint?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  positive: styles.positive,
  negative: styles.negative,
  neutral: '',
};

export function StatTile({ label, value, tone = 'neutral', hint }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${TONE_CLASS[tone]}`}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
