import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { Router } from './app/Router';
import { addToast } from './lib/toast';
import { errorMessage } from './lib/api';

for (const event of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(event, (e) => e.preventDefault());
}

// A rejected promise nobody awaited would otherwise vanish into the console.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[APP] Unhandled rejection', e.reason);
  addToast(errorMessage(e.reason, 'Unexpected error'), 'error');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
