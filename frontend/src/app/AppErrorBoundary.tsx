import { Component, type ReactNode } from 'react';
import styles from './AppErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Last line of defence for a render error anywhere in the app: show what
// happened and offer a reload instead of a blank screen.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[APP] Unhandled render error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.message}>{this.state.error.message || 'Unexpected error'}</p>
          <button type="button" className={styles.button} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
