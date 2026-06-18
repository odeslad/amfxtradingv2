import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'local.amfxtrading.com',
    port: 5173,
    https: {
      key: fs.readFileSync('./certs/local.amfxtrading.com-key.pem'),
      cert: fs.readFileSync('./certs/local.amfxtrading.com.pem'),
    },
  },
});
