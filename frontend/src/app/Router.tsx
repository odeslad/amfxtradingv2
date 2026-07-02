import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { JournalPage } from '../features/journal/JournalPage';
import { ChartPage } from '../features/chart/ChartPage';
import { BacktestPage } from '../features/backtest/BacktestPage';
import { EnginePage } from '../features/engine/EnginePage';
import { ScannerPage } from '../features/scanner/ScannerPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/journal" replace />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/engine" element={<EnginePage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
