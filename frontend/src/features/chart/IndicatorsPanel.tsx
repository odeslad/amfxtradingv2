import styles from './IndicatorsPanel.module.css';

interface IndicatorsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function IndicatorsPanel({ open, onClose }: IndicatorsPanelProps) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Indicators</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {/* future indicators */}
        </div>
      </div>
    </>
  );
}
