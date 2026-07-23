// deploy smoke test: verify deploy.ps1 recovers from the Prisma DLL lock
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
import { setPositions } from './store/positions';
import { setTick } from './store/ticks';
import { setAccount } from './store/accounts';
import { syncColors } from './store/positionColors';
import { setBroadcaster } from './routes/commands';
import { Engine } from './engine/engine';
import { evaluateAlerts, setAlertBroadcaster } from './alerts/alert-evaluator';
import { refreshAlerts } from './alerts/alert-store';
import { evaluateEmaAlerts, setEmaAlertBroadcaster } from './alerts/ema-alert-evaluator';
import { refreshEmaAlerts } from './alerts/ema-alert-store';

type Wss = ReturnType<typeof createWss>;

function startBroker(brokerName: string, bridgePath: string, wss: Wss) {
  const { features } = config;
  const pipe = features.pipe ? new PipeReader(brokerName) : null;
  const watcher = features.watcher ? new FileWatcher(brokerName, bridgePath) : null;
  const engine = features.engine ? new Engine(brokerName, bridgePath) : null;

  let currency = '';
  let brokerOffset = 0;

  pipe?.on('ticks', (batch) => {
    if (batch.length > 0) brokerOffset = batch[0].broker_offset ?? brokerOffset;
    for (const tick of batch) setTick(brokerName, tick.symbol, tick.bid, tick.ask);
    if (features.wsBroadcast) wss.broadcastTicks(brokerName, batch);
    engine?.processTicks(batch);
    if (features.alerts) {
      evaluateAlerts(brokerName, batch);
      evaluateEmaAlerts(brokerName, batch);
    }
  });

  pipe?.on('positions', (positions) => {
    setPositions(brokerName, positions, currency, brokerOffset);
    if (features.wsBroadcast) wss.broadcastPositions(brokerName, positions, currency, brokerOffset);
    const tickets = (positions as { ticket: number }[]).map(p => p.ticket);
    syncColors(brokerName, tickets).catch(() => {});
  });

  pipe?.on('account', (account) => {
    currency = account.currency ?? currency;
    setAccount(brokerName, { balance: account.balance, currency: account.currency ?? currency });
    if (features.wsBroadcast) wss.broadcastAccount(brokerName, account);
  });

  watcher?.on('candles', async ({ symbol, timeframe, ...data }) => {
    try { await upsertCandles(brokerName, symbol, timeframe, data); }
    catch (err) { console.error(`[DB:${brokerName}] candles upsert failed ${symbol} ${timeframe}`, err); }
  });

  watcher?.on('history', async (trades) => {
    try { await syncTrades(brokerName, trades); }
    catch (err) { console.error(`[DB:${brokerName}] trades sync failed`, err); }
  });

  watcher?.on('account', async (account) => {
    currency = account.currency ?? currency;
    if (features.wsBroadcast) wss.broadcastAccount(brokerName, account);
    try { await saveDailyBalances(brokerName, account); }
    catch (err) { console.error(`[DB:${brokerName}] account snapshot failed`, err); }
  });

  pipe?.start();
  watcher?.start();

  console.log(`[BROKER] Started: ${brokerName} | bridge: ${bridgePath}`);

  return { pipe, watcher };
}

async function main() {
  console.log(`[BACKEND] Starting | ${new Date().toISOString()}`);
  const disabled = Object.entries(config.features).filter(([, on]) => !on).map(([k]) => k);
  console.log(`[FEATURES] Disabled: ${disabled.length > 0 ? disabled.join(', ') : 'none'}`);
  await db.$connect();
  console.log('[DB] Connected');

  await refreshAlerts();
  await refreshEmaAlerts();
  console.log('[ALERT] Armed alerts loaded');

  const server = http.createServer(app);
  const wss = createWss(server);
  setBroadcaster((id, status, ticket, error) => wss.broadcastCommandResult(id, status, ticket, error));
  setAlertBroadcaster((userId, broker, symbol, price, direction) => wss.broadcastAlert(userId, broker, symbol, price, direction));
  setEmaAlertBroadcaster((userId, broker, symbol, timeframe, direction) => wss.broadcastEmaAlert(userId, broker, symbol, timeframe, direction));

  const watchers = config.brokers.map(({ name, bridgePath }) =>
    startBroker(name, bridgePath, wss),
  );

  server.listen(config.port, () => {
    console.log(`[HTTP] Listening on port ${config.port}`);
    console.log(`[BROKER] Active brokers: ${config.brokers.map((b) => b.name).join(', ')}`);
  });

  process.on('SIGTERM', async () => {
    watchers.forEach(({ pipe, watcher }) => { pipe?.stop(); watcher?.stop(); });
    await db.$disconnect();
    server.close();
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
