import { useAuth } from '../auth/AuthContext';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>AMFX</span>
        <div className={styles.userBar}>
          <span className={styles.email}>{user?.email}</span>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>
      <main className={styles.main}>
        <p className={styles.placeholder}>Dashboard — coming soon</p>
      </main>
    </div>
  );
}
