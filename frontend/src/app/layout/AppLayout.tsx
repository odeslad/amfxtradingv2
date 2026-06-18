import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import styles from './AppLayout.module.css';

const NAV = [
  { label: 'Journal', to: '/journal' },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <span className={styles.brand}>AMFX</span>
        <div className={styles.userBar}>
          <span className={styles.email}>{user?.email}</span>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.sidebar}>
          <span className={styles.sectionLabel}>Trading</span>
          {NAV.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
