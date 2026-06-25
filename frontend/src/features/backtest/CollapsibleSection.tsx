import { useState, type ReactNode } from 'react';
import styles from './ConfigPanel.module.css';

interface Props {
  title: string;
  defaultOpen?: boolean;
  bordered?: boolean;
  dimmed?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, bordered = false, dimmed = false, action, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${styles.section} ${bordered ? styles.sectionBordered : ''}`}>
      <div className={styles.sectionHeader}>
        <button type="button" className={`${styles.sectionToggle} ${dimmed ? styles.dimmed : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`}>▶</span>
          <span className={styles.sectionTitle}>{title}</span>
        </button>
        {action}
      </div>
      {open && <div className={`${styles.sectionBody} ${dimmed ? styles.dimmed : ''}`}>{children}</div>}
    </div>
  );
}
