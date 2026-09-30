// Disposable smoke test for spec 004. Node >= 18, no dependencies.
//
//   EMAIL=... PASSWORD=... node smoke.mjs capture [baseUrl]   # save baseline.json
//   EMAIL=... PASSWORD=... node smoke.mjs diff    [baseUrl]   # replay valid requests, compare
//   EMAIL=... PASSWORD=... node smoke.mjs invalid [baseUrl]   # fire invalid requests, expect 400
//
// baseUrl defaults to http://localhost:3001. Never writes through the API:
// valid requests are GET only; invalid requests must be rejected before any
// write, which is exactly what the spec asserts.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, 'baseline.json');
const [mode = 'diff', baseUrl = 'http://localhost:3001'] = process.argv.slice(2);
const { EMAIL, PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) fail('EMAIL and PASSWORD env vars are required');

const FROM = '2026-06-01T00:00:00Z';
const TO = '2026-06-30T23:59:59Z';
const BEFORE = 1751328000; // 2025-07-01 00:00 UTC

async function login() {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) fail(`login failed: ${res.status}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) fail('no session cookie returned');
  return cookie;
}

async function call(cookie, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function discover(cookie) {
  const balances = await call(cookie, 'GET', '/balances');
  const broker = balances.body?.[0]?.broker;
  if (!broker) fail('no broker in /balances — cannot build the request list');
  const symbols = await call(cookie, 'GET', `/symbols?broker=${encodeURIComponent(broker)}`);
  const symbol = symbols.body?.[0] ?? 'EURUSD';
  const alerts = await call(cookie, 'GET', '/alerts');
  const emaAlerts = await call(cookie, 'GET', '/ema-alerts');
  return { broker, symbol, alertId: alerts.body?.[0]?.id ?? null, emaAlertId: emaAlerts.body?.[0]?.id ?? null };
}

// Valid requests: what the frontend sends today. `volatile` = compared by
// shape only (status + top-level keys/types) because the data moves.
function validRequests({ broker, symbol }) {
  const b = encodeURIComponent(broker);
  const s = encodeURIComponent(symbol);
  return [
    { path: '/auth/me' },
    { path: '/balances' },
    { path: '/balances/daily-pnl', volatile: true },
    { path: '/positions/live', volatile: true },
    { path: '/settings' },
    { path: '/chart-indicators' },
    { path: '/alerts' },
    { path: '/ema-alerts' },
    { path: '/push/vapid' },
    { path: `/symbols?broker=${b}` },
    { path: '/symbols' },
    { path: `/trades?broker=${b}&from=${FROM}&to=${TO}&limit=50&offset=0` },
    { path: `/trades?limit=200` , volatile: true },
    { path: `/candles?broker=${b}&symbol=${s}&tf=H1&limit=200&before=${BEFORE}` },
    { path: `/candles?broker=${b}&symbol=${s}&tf=H1&limit=2000`, volatile: true },
    { path: `/candles/emas?broker=${b}&symbol=${s}&tf=H1&emaFast=9&emaSlow=21&from=${BEFORE - 86400 * 30}&to=${BEFORE}` },
    { path: `/drawings?broker=${b}&symbol=${s}&timeframe=H1` },
    { path: `/setup-levels?broker=${b}&symbol=${s}&tf=H1&emaFast=9&emaSlow=21`, volatile: true },
    { path: `/scanner?broker=${b}&tf=H1&emaFast=9&emaSlow=21`, volatile: true },
    { path: `/stats?broker=${b}&from=${FROM}&to=${TO}` },
    { path: `/stats?broker=${b}`, volatile: true },
  ];
}

// Invalid requests: every AC 3–11 case. Each must answer 400.
function invalidRequests({ broker, symbol, alertId, emaAlertId }) {
  const b = encodeURIComponent(broker);
  const s = encodeURIComponent(symbol);
  const list = [
    ['GET', `/trades?limit=abc`],
    ['GET', `/trades?limit=-1`],
    ['GET', `/trades?offset=x`],
    ['GET', `/trades?from=notadate`],
    ['GET', `/trades?to=2026-13-45`],
    ['GET', `/trades?broker=a&broker=b`],
    ['GET', `/candles?broker=${b}&symbol=${s}&tf=H1&limit=abc`],
    ['GET', `/candles?broker=${b}&symbol=${s}&tf=H1&before=x`],
    ['GET', `/candles?broker=${b}&symbol=${s}&tf=H1&after=-5`],
    ['GET', `/candles?broker=${b}&symbol=${s}&symbol=${s}&tf=H1`],
    ['GET', `/candles/emas?broker=${b}&symbol=${s}&tf=H1&emaFast=x&emaSlow=21`],
    ['GET', `/candles/emas?broker=${b}&symbol=${s}&tf=H1&emaFast=9&emaSlow=0`],
    ['GET', `/candles/emas?broker=${b}&symbol=${s}&tf=H1&emaFast=9&emaSlow=21&from=abc`],
    ['GET', `/symbols?broker=a&broker=b`],
    ['GET', `/stats?broker=${b}&broker=${b}`],
    ['PATCH', '/positions/color', { broker, ticket: 'abc', color: '#fff' }],
    ['PATCH', '/positions/color', { broker, ticket: 1, color: 42 }],
    ['PUT', '/settings', { mirror: [{ broker, enabled: 'yes', lotsMode: 'fixed', lots: 0.1 }] }],
    ['PUT', '/settings', { mirror: [{ broker, enabled: true, lotsMode: 'random', lots: 0.1 }] }],
    ['PUT', '/settings', { mirror: [{ broker, enabled: true, lotsMode: 'fixed', lots: -1 }] }],
    ['PUT', '/settings', { mirror: [{ broker: '', enabled: true, lotsMode: 'fixed', lots: 0.1 }] }],
    ['PUT', '/settings', { display: { pnlMode: 'euros' } }],
    ['PUT', '/settings', { display: { pnlMode: 'net', trendlineStyle: 'wavy' } }],
    ['PUT', '/settings', { display: { pnlMode: 'net', trendlineWidth: 0 } }],
    ['PUT', '/settings', { display: { pnlMode: 'net', trendlineColor: 7 } }],
    ['PUT', '/chart-indicators', {}],
    ['PUT', '/chart-indicators', { emas: 'nope' }],
    ['POST', '/commands', { action: 'yolo', id: 'a1', broker, symbol, lots: 0.1 }],
    ['POST', '/commands', { action: 'buy', id: 'bad id!', broker, symbol, lots: 0.1 }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol, lots: 'x' }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol, lots: 0 }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol, lots: 0.1, sl: 'x' }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol, lots: 0.1, tp: -1 }],
    ['POST', '/commands', { action: 'buylimit', id: 'a1', broker, symbol, lots: 0.1, price: 'x' }],
    ['POST', '/commands', { action: 'close', id: 'a1', broker, symbol }],
    ['POST', '/commands', { action: 'close', id: 'a1', broker, symbol, ticket: 1.5 }],
    ['POST', '/commands', { action: 'modify', id: 'a1', broker, symbol, ticket: 'abc' }],
    ['POST', '/commands', { action: 'buy', id: 'a1', broker, symbol, lotsMode: 'risk_pct', lots: 1 }], // no sl → 400 already today
  ];
  if (alertId !== null) {
    list.push(['PUT', `/alerts/${alertId}`, { price: 'x' }]);
    list.push(['PUT', `/alerts/${alertId}`, { direction: 'sideways' }]);
    list.push(['PUT', `/alerts/${alertId}`, { enabled: 'yes' }]);
  } else {
    console.log('note: no price alert exists — PUT /alerts/:id cases skipped');
  }
  if (emaAlertId !== null) {
    list.push(['PUT', `/ema-alerts/${emaAlertId}`, { emaFast: 1.5 }]);
    list.push(['PUT', `/ema-alerts/${emaAlertId}`, { thresholdPips: -1 }]);
    list.push(['PUT', `/ema-alerts/${emaAlertId}`, { direction: 'up' }]);
  } else {
    console.log('note: no EMA alert exists — PUT /ema-alerts/:id cases skipped');
  }
  return list;
}

const shape = (v) => {
  if (Array.isArray(v)) return `array(${v.length > 0 ? shape(v[0]) : ''})`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${k}:${typeof v[k]}`).join(',')}}`;
  return typeof v;
};

function fail(msg) { console.error(`ERROR: ${msg}`); process.exit(1); }

const cookie = await login();
const ctx = await discover(cookie);
console.log(`base ${baseUrl} · broker ${ctx.broker} · symbol ${ctx.symbol}\n`);

if (mode === 'capture') {
  const results = {};
  for (const { path, volatile } of validRequests(ctx)) {
    const r = await call(cookie, 'GET', path);
    results[path] = { status: r.status, volatile: !!volatile, body: volatile ? shape(r.body) : r.body };
    console.log(`${r.status}  ${volatile ? '~' : '='}  ${path}`);
  }
  writeFileSync(baselinePath, JSON.stringify({ ctx, results }, null, 2));
  const bad = Object.values(results).filter((r) => r.status !== 200).length;
  console.log(`\nbaseline saved: ${Object.keys(results).length} requests, ${bad} non-200`);
  process.exit(bad === 0 ? 0 : 1);
}

if (mode === 'diff') {
  if (!existsSync(baselinePath)) fail('no baseline.json — run capture first');
  const { results } = JSON.parse(readFileSync(baselinePath, 'utf8'));
  let diffs = 0;
  for (const [path, expected] of Object.entries(results)) {
    const r = await call(cookie, 'GET', path);
    const actual = expected.volatile ? shape(r.body) : r.body;
    const same = r.status === expected.status && JSON.stringify(actual) === JSON.stringify(expected.body);
    if (!same) diffs++;
    console.log(`${same ? 'ok  ' : 'DIFF'}  ${r.status}  ${path}`);
    if (!same && !expected.volatile) {
      console.log(`      expected: ${JSON.stringify(expected.body).slice(0, 200)}`);
      console.log(`      actual:   ${JSON.stringify(r.body).slice(0, 200)}`);
    }
  }
  console.log(`\n${diffs} difference(s) in ${Object.keys(results).length} requests`);
  process.exit(diffs === 0 ? 0 : 1);
}

if (mode === 'invalid') {
  let wrong = 0;
  for (const [method, path, body] of invalidRequests(ctx)) {
    const r = await call(cookie, method, path, body);
    const ok = r.status === 400;
    if (!ok) wrong++;
    const msg = typeof r.body === 'object' && r.body ? (r.body.error ?? r.body.message ?? '') : '';
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.status}  ${method.padEnd(5)} ${path}${body ? ' ' + JSON.stringify(body) : ''}${msg ? `  → ${msg}` : ''}`);
  }
  console.log(`\n${wrong} request(s) not answered with 400`);
  process.exit(wrong === 0 ? 0 : 1);
}

fail(`unknown mode "${mode}" (capture | diff | invalid)`);
