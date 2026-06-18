import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { Router } from './app/Router';

for (const event of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(event, (e) => e.preventDefault());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
