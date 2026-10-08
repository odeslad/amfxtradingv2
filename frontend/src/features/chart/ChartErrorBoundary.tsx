import { Component, type ReactNode } from 'react';
import styles from './ChartErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  resetKey: string;
}

interface State {
  failed: boolean;
  attempts: number;
}

// Transient failures (lightweight-charts throwing "Value is null" mid-switch)
// recover on the next frame; a persistent one stops after this many tries.
const MAX_AUTO_RETRIES = 3;

// lightweight-charts can throw transiently ("Value is null") when a hitTest hits
// a series mid-reconstruction on symbol/timeframe switch. Catch it and remount
// the chart on the next render instead of crashing the whole page. After
// MAX_AUTO_RETRIES in a row the fallback stays up with a manual retry, so a
// persistent error does not become a remount loop.
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempts: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && (this.state.failed || this.state.attempts > 0)) {
      this.setState({ failed: false, attempts: 0 });
    }
  }

  componentDidCatch(error: Error) {
    const attempts = this.state.attempts + 1;
    if (attempts > MAX_AUTO_RETRIES) {
      console.error('[CHART] Giving up after repeated render errors', error);
      this.setState({ attempts });
      return;
    }
    // recover on the next frame so the chart remounts cleanly
    requestAnimationFrame(() => this.setState({ failed: false, attempts }));
  }

  retry = () => this.setState({ failed: false, attempts: 0 });

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.state.attempts <= MAX_AUTO_RETRIES) return null;
    return (
      <div className={styles.fallback}>
        <span className={styles.text}>Chart failed to render</span>
        <button type="button" className={styles.button} onClick={this.retry}>Retry</button>
      </div>
    );
  }
}
