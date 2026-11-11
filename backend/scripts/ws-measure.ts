// Measures what one WebSocket client receives from a running backend (spec 041, AC 7).
//
//   npx tsx --env-file=.env scripts/ws-measure.ts [--subscribe "<broker>:<symbol>" ...] [--seconds 60] [--port 3000]
//
// Connects to ws://localhost:<port>/ws as user 1 with a token signed by JWT_SECRET, sends
// the given subscription (none = no ticks expected) and prints the bytes per message type.
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

interface Options { subscribe: { broker: string; symbol: string }[]; seconds: number; port: number }

function parseArgs(argv: string[]): Options {
  const options: Options = { subscribe: [], seconds: 60, port: parseInt(process.env['PORT'] ?? '3000', 10) };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--subscribe' && value) {
      const at = value.lastIndexOf(':');
      if (at <= 0) throw new Error(`--subscribe expects "<broker>:<symbol>", got "${value}"`);
      options.subscribe.push({ broker: value.slice(0, at), symbol: value.slice(at + 1) });
      i += 1;
    } else if (arg === '--seconds' && value) {
      options.seconds = parseInt(value, 10);
      i += 1;
    } else if (arg === '--port' && value) {
      options.port = parseInt(value, 10);
      i += 1;
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }
  return options;
}

const secret = process.env['JWT_SECRET'];
if (!secret) {
  console.error('JWT_SECRET is not set: run with --env-file=.env');
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const token = jwt.sign({ sub: 1 }, secret, { expiresIn: '5m' });
const byType = new Map<string, { bytes: number; count: number }>();
const pairs = new Set<string>();
let total = 0;
let tickItems = 0;

const ws = new WebSocket(`ws://localhost:${options.port}/ws`, {
  headers: { Origin: 'https://app-v2.amfxtrading.com', Cookie: `token=${token}` },
});

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', ticks: options.subscribe }));
  const what = options.subscribe.length === 0 ? 'no subscription' : options.subscribe.map(p => `${p.broker}:${p.symbol}`).join(', ');
  console.log(`connected, ${what}, measuring ${options.seconds} s...`);
});

ws.on('message', data => {
  const text = data.toString();
  const bytes = Buffer.byteLength(text);
  total += bytes;
  let type = '?';
  try {
    const message = JSON.parse(text) as { type?: string; broker?: string; ticks?: { symbol: string }[] };
    type = message.type ?? '?';
    if (message.type === 'ticks' && message.ticks) {
      tickItems += message.ticks.length;
      for (const tick of message.ticks) pairs.add(`${message.broker}|${tick.symbol}`);
    }
  } catch {
    // Not JSON: counted under '?'.
  }
  const entry = byType.get(type) ?? { bytes: 0, count: 0 };
  entry.bytes += bytes;
  entry.count += 1;
  byType.set(type, entry);
});

ws.on('error', err => {
  console.error('error:', err.message || String(err));
  process.exit(1);
});

ws.on('unexpected-response', (_req, res) => {
  console.error(`handshake rejected: HTTP ${res.statusCode}`);
  process.exit(1);
});

setTimeout(() => {
  ws.close();
  const secs = options.seconds;
  console.log(JSON.stringify({
    seconds: secs,
    totalBytes: total,
    bytesPerSecond: Math.round(total / secs),
    kbitPerSecond: Math.round((total * 8) / secs / 1000),
    mbPerHour: +((total / secs) * 3600 / 1e6).toFixed(1),
    tickItems,
    distinctBrokerSymbols: pairs.size,
    byType: Object.fromEntries(byType),
  }, null, 2));
  process.exit(0);
}, options.seconds * 1000);
