import 'dotenv/config';
import http from 'http';
import app from './app';
import { config } from './config';
import { db } from './db/client';
import { PipeReader } from './bridge/pipe-reader';
import { FileWatcher } from './bridge/file-watcher';
import { createTicksWss } from './ws/ticks';
import { upsertCandles } from './services/candles';
import { syncPositions } from './services/positions';
import { syncTrades } from './services/trades';
import { saveDailyBalances } from './services/account';
import { Engine } from './engine/engine';

type TicksWss = ReturnType<typeof createTicksWss>;

function startBroker(brokerName: string, bridgePath: string, wss: TicksWss) {
  const pipe = new PipeReader(brokerName);
  const watcher = new FileWatcher(brokerName, bridgePath);
  const engine = new Engine(brokerName, bridgePath);

  pipe.on('ticks', (batch) => {
    wss.broadcast(brokerName, batch);
    engine.processTicks(batch);
  });

  watcher.on('candles', async ({ symbol, timeframe, ...data }) => {
    try { await upsertCandles(brokerName, symbol, timeframe, data); }
    catch (err) { console.error(`[DB:${brokerName}] candles upsert failed ${symbol} ${timeframe}`, err); }
  });

  watcher.on('positions', async (positions) => {
    try { await syncPositions(brokerName, positions); }
    catch (err) { console.error(`[DB:${brokerName}] positions sync failed`, err); }
  });

  watcher.on('history', async (trades) => {
    try { await syncTrades(brokerName, trades); }
    catch (err) { console.error(`[DB:${brokerName}] trades sync failed`, err); }
  });

  watcher.on('account', async (account) => {
    try { await saveDailyBalances(brokerName, account); }
    catch (err) { console.error(`[DB:${brokerName}] account snapshot failed`, err); }
  });

  pipe.start();
  watcher.start();

  console.log(`[BROKER] Started: ${brokerName} | bridge: ${bridgePath}`);

  return { pipe, watcher };
}

async function main() {
  await db.$connect();
  console.log('[DB] Connected');

  const server = http.createServer(app);
  const wss = createTicksWss(server);

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
