import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  resetKey: string;
}

interface State {
  failed: boolean;
}

// lightweight-charts can throw transiently ("Value is null") when a hitTest hits
// a series mid-reconstruction on symbol/timeframe switch. Catch it and remount
// the chart on the next render instead of crashing the whole page.
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch() {
    // recover on the next frame so the chart remounts cleanly
    requestAnimationFrame(() => this.setState({ failed: false }));
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
