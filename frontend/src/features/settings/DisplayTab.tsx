import type { PnlMode } from '../journal/utils/position';
import type { TrendlineStyle } from '../chart/DrawingTools';
import styles from './SettingsPage.module.css';

export interface DisplaySettingsForm {
  pnlMode: PnlMode;
  trendlineColor: string;
  trendlineStyle: TrendlineStyle;
  trendlineWidth: number;
  rectLabels: boolean;
}

const TRENDLINE_COLORS = ['#8c8c8c', '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840'];
const TRENDLINE_WIDTHS = [1, 2, 3];

interface DisplayTabProps {
  display: DisplaySettingsForm;
  onChange: (patch: Partial<DisplaySettingsForm>) => void;
}

export function DisplayTab({ display, onChange }: DisplayTabProps) {
  return (
    <>
      <p className={styles.desc}>How data is shown across the app.</p>

      <div className={styles.displayList}>
        <div className={styles.displayRow}>
          <span className={styles.displayLabel}>P&amp;L Mode</span>
          <select className={styles.select} value={display.pnlMode} onChange={e => onChange({ pnlMode: e.target.value as PnlMode })}>
            <option value="net">Net (profit + swap + commission)</option>
            <option value="gross">Gross (profit only)</option>
            <option value="pips">Pips</option>
            <option value="pct">% Net (over account balance)</option>
          </select>
        </div>

        <div className={styles.displayRow}>
          <span className={styles.displayLabel}>Trendline style</span>
          <select className={styles.select} value={display.trendlineStyle} onChange={e => onChange({ trendlineStyle: e.target.value as TrendlineStyle })}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        <div className={styles.displayRow}>
          <span className={styles.displayLabel}>Trendline width</span>
          <select className={styles.select} value={display.trendlineWidth} onChange={e => onChange({ trendlineWidth: Number(e.target.value) })}>
            {TRENDLINE_WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}
          </select>
        </div>

        <div className={styles.displayRow}>
          <span className={styles.displayLabel}>Trendline color</span>
          <div className={styles.colorSwatches}>
            {TRENDLINE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${display.trendlineColor === c ? styles.colorSwatchActive : ''}`}
                style={{ background: c }}
                onClick={() => onChange({ trendlineColor: c })}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className={`${styles.displayRow} ${styles.displayRowInline}`}>
          <span className={styles.displayLabel}>Rectangle labels (prices and pips)</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={display.rectLabels} onChange={e => onChange({ rectLabels: e.target.checked })} aria-label="Rectangle labels" />
            <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
          </label>
        </div>
      </div>
    </>
  );
}
