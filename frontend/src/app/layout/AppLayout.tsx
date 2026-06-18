import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { IconJournal, IconChart, IconBacktest, IconEngine, IconSettings, IconSignOut } from '../../shared/ui/icons';
import styles from './AppLayout.module.css';

const NAV = [
  { label: 'Journal', to: '/journal', icon: <IconJournal /> },
  { label: 'Chart', to: '/chart', icon: <IconChart /> },
  { label: 'Backtest', to: '/backtest', icon: <IconBacktest /> },
  { label: 'Engine', to: '/engine', icon: <IconEngine /> },
  { label: 'Settings', to: '/settings', icon: <IconSettings /> },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <span className={styles.brand}>AMFX</span>
        <div className={styles.userBar}>
          <span className={styles.email}>{user?.email}</span>
          <button className={styles.logoutBtn} onClick={logout} title="Sign out"><IconSignOut size={13} /></button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Desktop sidebar */}
        <nav className={styles.sidebar}>
          {NAV.map(({ label, to, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <footer className={styles.footer}>
        AMFX Trading Terminal v2.0 &nbsp;·&nbsp; © {new Date().getFullYear()}
      </footer>

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        {NAV.map(({ label, to, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`
            }
          >
            {icon}
            <span className={styles.bottomNavLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
