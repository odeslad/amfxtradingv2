import { useEffect, useState, type ReactNode } from 'react';
import { apiFetch, apiSend, setUnauthorizedHandler } from '../../lib/api';
import { AuthContext, type User } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    apiFetch<User | null>('/auth/me')
      .then(data => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiSend<{ user: User }>('/auth/login', 'POST', { email, password });
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiSend('/auth/logout', 'POST');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
