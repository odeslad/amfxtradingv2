import 'dotenv/config';
import http from 'http';
import app from './app';
import { config } from './config';
import { db } from './db/client';
import { pipeReader } from './bridge/pipe-reader';
import { fileWatcher } from './bridge/file-watcher';
import { createTicksWss } from './ws/ticks';
import { upsertCandles } from './services/candles';
import { syncPositions } from './services/positions';
import { syncTrades } from './services/trades';
import { saveAccountSnapshot } from './services/account';

async function main() {
  await db.$connect();
  console.log('[DB] Connected');

  const server = http.createServer(app);
  const ticksWss = createTicksWss(server);

  pipeReader.on('ticks', (batch) => ticksWss.broadcast(batch));
  pipeReader.start();

  fileWatcher.on('candles', async ({ symbol, timeframe, ...data }) => {
    try {
      await upsertCandles(config.brokerName, symbol, timeframe, data);
    } catch (err) {
      console.error(`[DB] candles upsert failed ${symbol} ${timeframe}`, err);
    }
  });

  fileWatcher.on('positions', async (positions) => {
    try {
      await syncPositions(config.brokerName, positions);
    } catch (err) {
      console.error('[DB] positions sync failed', err);
    }
  });

  fileWatcher.on('history', async (trades) => {
    try {
      await syncTrades(config.brokerName, trades);
    } catch (err) {
      console.error('[DB] trades sync failed', err);
    }
  });

  fileWatcher.on('account', async (account) => {
    try {
      await saveAccountSnapshot(config.brokerName, account);
    } catch (err) {
      console.error('[DB] account snapshot failed', err);
    }
  });

  fileWatcher.start();

  server.listen(config.port, () => {
    console.log(`[HTTP] Listening on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    fileWatcher.stop();
    await db.$disconnect();
    server.close();
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
