import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const KEY_PATH = './certs/local.amfxtrading.com-key.pem';
const CERT_PATH = './certs/local.amfxtrading.com.pem';

const hasCerts = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);

export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('lightweight-charts')) return 'lightweight-charts';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('node_modules/react/')) return 'react-vendor';
        },
      },
    },
  },
  server:
    command === 'serve' && hasCerts
      ? {
          host: 'local.amfxtrading.com',
          port: 5173,
          https: {
            key: fs.readFileSync(KEY_PATH),
            cert: fs.readFileSync(CERT_PATH),
          },
          // Same-origin API for local development: run the backend on localhost,
          // start Vite with VITE_API_BASE=/__api and the session cookie becomes first-party.
          proxy: {
            '/__api': {
              target: process.env.DEV_API_TARGET ?? 'http://localhost:3000',
              ws: true,
              rewrite: (path: string) => path.replace(/^\/__api/, ''),
            },
          },
        }
      : undefined,
}));
