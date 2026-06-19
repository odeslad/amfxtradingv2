import 'dotenv/config';
import http from 'http';
import app from './app';
import { config } from './config';
import { db } from './db/client';
import { PipeReader } from './bridge/pipe-reader';
import { FileWatcher } from './bridge/file-watcher';
import { createWss } from './ws/ws';
import { upsertCandles } from './services/candles';
import { syncTrades } from './services/trades';
import { saveDailyBalances } from './services/account';
import { Engine } from './engine/engine';

type Wss = ReturnType<typeof createWss>;

function startBroker(brokerName: string, bridgePath: string, wss: Wss) {
  const pipe = new PipeReader(brokerName);
  const watcher = new FileWatcher(brokerName, bridgePath);
  const engine = new Engine(brokerName, bridgePath);

  let currency = '';
  let brokerOffset = 0;

  pipe.on('ticks', (batch) => {
    if (batch.length > 0) brokerOffset = batch[0].broker_offset ?? brokerOffset;
    wss.broadcastTicks(brokerName, batch);
    engine.processTicks(batch);
  });

  pipe.on('positions', (positions) => {
    wss.broadcastPositions(brokerName, positions, currency, brokerOffset);
  });

  watcher.on('candles', async ({ symbol, timeframe, ...data }) => {
    try { await upsertCandles(brokerName, symbol, timeframe, data); }
    catch (err) { console.error(`[DB:${brokerName}] candles upsert failed ${symbol} ${timeframe}`, err); }
  });

  watcher.on('history', async (trades) => {
    try { await syncTrades(brokerName, trades); }
    catch (err) { console.error(`[DB:${brokerName}] trades sync failed`, err); }
  });

  watcher.on('account', async (account) => {
    currency = account.currency ?? currency;
    try { await saveDailyBalances(brokerName, account); }
    catch (err) { console.error(`[DB:${brokerName}] account snapshot failed`, err); }
  });

  pipe.start();
  watcher.start();

  console.log(`[BROKER] Started: ${brokerName} | bridge: ${bridgePath}`);

  return { pipe, watcher };
}

async function main() {
  console.log(`[BACKEND] Starting | ${new Date().toISOString()}`);
  await db.$connect();
  console.log('[DB] Connected');

  const server = http.createServer(app);
  const wss = createWss(server);

  const watchers = config.brokers.map(({ name, bridgePath }) =>
    startBroker(name, bridgePath, wss),
  );

  server.listen(config.port, () => {
    console.log(`[HTTP] Listening on port ${config.port}`);
    console.log(`[BROKER] Active brokers: ${config.brokers.map((b) => b.name).join(', ')}`);
  });

  process.on('SIGTERM', async () => {
    watchers.forEach(({ pipe, watcher }) => { pipe.stop(); watcher.stop(); });
    await db.$disconnect();
    server.close();
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
