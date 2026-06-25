import { useEffect, useState } from 'react';
import styles from './ConfigPanel.module.css';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  nullable?: boolean;
  placeholder?: string;
}

export function NumberInput({ value, onChange, nullable = false, placeholder }: Props) {
  const [text, setText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setText(value === null ? '' : String(value));
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    if (raw === '' || raw === '-') {
      if (nullable) onChange(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) onChange(nullable ? parsed : parsed);
  };

  const handleBlur = () => {
    if (text === '' || text === '-') {
      if (!nullable) {
        setText('0');
        onChange(0);
      }
    }
  };

  return (
    <input
      className={styles.input}
      type="number"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={e => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
