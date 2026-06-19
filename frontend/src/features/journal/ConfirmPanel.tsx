import styles from './ConfirmPanel.module.css';

interface ConfirmPanelProps {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmPanel({ open, title, description, detail, confirmLabel = 'Confirm', confirming, onConfirm, onClose }: ConfirmPanelProps) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.description}>{description}</div>
          {detail && <div className={styles.detail}>{detail}</div>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.confirmBtn} onClick={onConfirm} disabled={confirming}>
              {confirming ? 'Closing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
