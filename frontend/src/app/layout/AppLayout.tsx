import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { IconJournal, IconChart, IconScanner, IconBacktest, IconEngine, IconSettings, IconSignOut } from '../../shared/ui/icons';
import { Toaster } from '../../components/Toaster';
import { subscribe } from '../../lib/ws';
import { addToast } from '../../lib/toast';
import styles from './AppLayout.module.css';

const NAV = [
  { label: 'Journal', to: '/journal', icon: <IconJournal /> },
  { label: 'Chart', to: '/chart', icon: <IconChart /> },
  { label: 'Scanner', to: '/scanner', icon: <IconScanner /> },
  // Experimental: shown muted and not navigable until stabilised.
  { label: 'Backtest', to: '/backtest', icon: <IconBacktest />, disabled: true },
  { label: 'Engine', to: '/engine', icon: <IconEngine />, disabled: true },
  { label: 'Settings', to: '/settings', icon: <IconSettings /> },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  useEffect(() => subscribe((data) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; id: string; status: string; ticket?: number; error?: string };
    if (msg.type !== 'command_result') return;
    if (msg.status === 'ok') {
      const detail = msg.ticket != null ? ` — ticket #${msg.ticket}` : '';
      addToast(`Order executed${detail}`, 'success');
    } else if (msg.status === 'timeout') {
      addToast('No response from EA', 'error');
    } else {
      addToast(msg.error ?? `EA error: ${msg.status}`, 'error');
    }
  }), []);

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
          {NAV.map(({ label, to, icon, disabled }) => (
            disabled ? (
              <span
                key={to}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                title="Experimental — coming soon"
                aria-disabled="true"
              >
                <span className={styles.navIcon}>{icon}</span>
                <span className={styles.navLabel}>{label}</span>
              </span>
            ) : (
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
            )
          ))}
        </nav>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <footer className={styles.footer}>
        AMFX Trading Terminal v2.0 &nbsp;·&nbsp; © {new Date().getFullYear()}
      </footer>

      <Toaster />

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        {NAV.map(({ label, to, icon, disabled }) => (
          disabled ? (
            <span
              key={to}
              className={`${styles.bottomNavItem} ${styles.navItemDisabled}`}
              aria-disabled="true"
            >
              {icon}
              <span className={styles.bottomNavLabel}>{label}</span>
            </span>
          ) : (
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
          )
        ))}
      </nav>
    </div>
  );
}
