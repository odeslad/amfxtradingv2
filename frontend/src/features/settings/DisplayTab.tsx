import { SETUP_LEVEL_KEYS, type PnlMode, type SetupLevelKey } from '../journal/utils/position';
import { FIB_LEVEL_ANCHORS, FIB_LEVEL_CATALOGUE, type TrendlineStyle } from '../chart/DrawingTools';
import { EMA_TRADES_LIMITS, type EmaTradesSettings } from '../chart/emaTrades';
import styles from './SettingsPage.module.css';

export interface DisplaySettingsForm {
  pnlMode: PnlMode;
  trendlineColor: string;
  trendlineStyle: TrendlineStyle;
  trendlineWidth: number;
  rectLabels: boolean;
  showSpread: boolean;
  setupLevels: SetupLevelKey[];
  fibLevels: number[];
  emaTrades: EmaTradesSettings;
}

interface EmaTradesField {
  key: keyof EmaTradesSettings;
  label: string;
  hint?: string;
  min: number;
  max?: number;
  step: number;
}

const EMA_TRADES_FIELDS: EmaTradesField[] = [
  { key: 'fast', label: 'Fast EMA', min: 1, step: 1 },
  { key: 'slow', label: 'Slow EMA', min: 1, step: 1 },
  { key: 'entryPips', label: 'Entry offset (pips)', hint: 'Above the cross-candle close for a buy, below it for a sell', min: 0, step: 0.1 },
  { key: 'candles', label: 'Max duration (candles)', hint: 'Candles of the chart timeframe; lines end here or at the next opposite cross, whichever comes first', min: EMA_TRADES_LIMITS.candles.min, max: EMA_TRADES_LIMITS.candles.max, step: 1 },
  { key: 'count', label: 'Trades shown', hint: 'Most recent crosses, both directions', min: EMA_TRADES_LIMITS.count.min, max: EMA_TRADES_LIMITS.count.max, step: 1 },
];

const TRENDLINE_COLORS = ['#8c8c8c', '#f5a623', '#3a7bd5', '#4caf84', '#e05c5c', '#c8a840'];
const TRENDLINE_WIDTHS = [1, 2, 3];

const LEVEL_MEANING: Record<SetupLevelKey, string> = {
  ECC: 'Cross candle close',
  EMA: 'EMA cross price',
  EVL: 'Fast EMA extreme',
  MHL: 'Window high / low',
};

interface DisplayTabProps {
  display: DisplaySettingsForm;
  onChange: (patch: Partial<DisplaySettingsForm>) => void;
}

export function DisplayTab({ display, onChange }: DisplayTabProps) {
  const toggleLevel = (key: SetupLevelKey, on: boolean) => {
    const next = SETUP_LEVEL_KEYS.filter(k => (k === key ? on : display.setupLevels.includes(k)));
    onChange({ setupLevels: next });
  };

  const updateEmaTrades = (key: keyof EmaTradesSettings, raw: string) => {
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) return;
    onChange({ emaTrades: { ...display.emaTrades, [key]: value } });
  };

  const toggleFibLevel = (level: number, on: boolean) => {
    const next = FIB_LEVEL_CATALOGUE.filter(l => FIB_LEVEL_ANCHORS.includes(l) || (l === level ? on : display.fibLevels.includes(l)));
    onChange({ fibLevels: next });
  };

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

        <div className={`${styles.displayRow} ${styles.displayRowGroup}`}>
          <span className={styles.displayLabel}>
            Fibonacci levels
            <span className={styles.displayHint}>Levels drawn by the Fibonacci tool on every chart. 0 and 100 are the anchors and stay on.</span>
          </span>
          <div className={`${styles.levelGrid} ${styles.fibGrid}`}>
            {FIB_LEVEL_CATALOGUE.map(level => {
              const anchor = FIB_LEVEL_ANCHORS.includes(level);
              return (
                <div key={level} className={styles.levelCard}>
                  <span className={styles.levelKey}>{level} %</span>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={anchor || display.fibLevels.includes(level)}
                      disabled={anchor}
                      onChange={e => toggleFibLevel(level, e.target.checked)}
                      aria-label={`Fibonacci level ${level} %`}
                    />
                    <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${styles.displayRow} ${styles.displayRowGroup}`}>
          <span className={styles.displayLabel}>
            EMA cross trades
            <span className={styles.displayHint}>Drawn on the chart by the toolbar button: the last crosses of these EMAs, each with its entry and its SL.</span>
          </span>
          <div className={styles.emaTradesGrid}>
            {EMA_TRADES_FIELDS.map(field => (
              <label key={field.key} className={styles.emaTradesField}>
                <span className={styles.displayLabel}>
                  {field.label}
                  {field.hint && <span className={styles.displayHint}>{field.hint}</span>}
                </span>
                <input
                  type="number"
                  className={`${styles.input} ${styles.numberInput}`}
                  value={display.emaTrades[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={e => updateEmaTrades(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={`${styles.displayRow} ${styles.displayRowInline}`}>
          <span className={styles.displayLabel}>
            Spread (ASK and BID lines)
            <span className={styles.displayHint}>Replaces the current-price line on the chart</span>
          </span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={display.showSpread} onChange={e => onChange({ showSpread: e.target.checked })} aria-label="Spread" />
            <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
          </label>
        </div>

        <div className={`${styles.displayRow} ${styles.displayRowGroup}`}>
          <span className={styles.displayLabel}>
            Setup levels
            <span className={styles.displayHint}>Levels listed in the New Trade panel. All off hides the panel.</span>
          </span>
          <div className={styles.levelGrid}>
            {SETUP_LEVEL_KEYS.map(key => (
              <div key={key} className={styles.levelCard}>
                <span className={styles.levelKey}>
                  {key}
                  <span className={styles.levelMeaning}>{LEVEL_MEANING[key]}</span>
                </span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={display.setupLevels.includes(key)} onChange={e => toggleLevel(key, e.target.checked)} aria-label={key} />
                  <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
