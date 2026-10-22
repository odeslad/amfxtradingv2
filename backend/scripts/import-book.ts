import fs from 'node:fs';
import { db } from '../src/db/client';
import { chain, lotsFor } from '../src/book/calc';

// Loads the operator's book of schemes from the static HTML document
// (`const D = { t: [...], s: [...] }` embedded in it) into book_schemes and
// book_trades, idempotently, and proves the stored figures against calc.ts.
//
//   npx tsx --env-file=.env scripts/import-book.ts "<path to the html>"
//
// t rows: [ticket, scheme, slot, direction, lots, entry, sl, openTime, closeTime, closePrice, profit, r, balanceAfter, note]
// s rows: [number, start, end, tradesLine, tickets, result, netEur, netR]

type TradeRow = [number, number, string, string, number, number, number, string, string, number, number, number, number, string];
type SchemeRow = [number, string, string, string, string, string, number, number];

const TOLERANCE = 0.011;
const asDate = (s: string): Date => new Date(s.replace(' ', 'T') + (s.length === 10 ? 'T00:00:00' : ':00') + 'Z');

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('usage: import-book.ts <path to the html document>');
  const html = fs.readFileSync(path, 'utf8');
  const match = html.match(/const D=\s*(\{[\s\S]*?\})\s*[;\n]/);
  if (!match) throw new Error('no `const D = {...}` found in the document');
  const data = JSON.parse(match[1]) as { t: TradeRow[]; s: SchemeRow[] };
  console.log(`document: ${data.s.length} schemes, ${data.t.length} trades`);

  for (const s of data.s) {
    await db.bookScheme.upsert({
      where: { number: s[0] },
      update: { start: asDate(s[1]), end: s[2] ? asDate(s[2]) : null, result: s[5] },
      create: { number: s[0], start: asDate(s[1]), end: s[2] ? asDate(s[2]) : null, result: s[5] },
    });
  }
  const ids = new Map((await db.bookScheme.findMany({ select: { id: true, number: true } })).map(r => [r.number, r.id]));

  for (const t of data.t) {
    const schemeId = ids.get(t[1]);
    if (schemeId === undefined) throw new Error(`trade ${t[0]} points at scheme ${t[1]}, which the document lacks`);
    const data = {
      schemeId, slot: t[2], direction: t[3], lots: t[4], entry: t[5], sl: t[6], openTime: asDate(t[7]),
      closeTime: t[8] ? asDate(t[8]) : null, closePrice: t[8] ? t[9] : null, profit: t[8] ? t[10] : null, r: t[8] ? t[11] : null,
      balanceAfter: t[8] ? t[12] : null, note: t[13] || null,
    };
    await db.bookTrade.upsert({ where: { ticket: t[0] }, update: data, create: { ticket: t[0], ...data } });
  }

  // Prove the arithmetic on the real rows: the same chain the app keeps, from the document's lots.
  const closedRows = data.t.filter(t => t[8]);
  const computed = chain(closedRows.map(t => ({
    ticket: t[0], direction: t[3] as 'buy' | 'sell', entry: t[5], sl: t[6], lots: t[4], closePrice: t[9], closeTime: asDate(t[8]),
  })));
  const byTicket = new Map(closedRows.map(t => [t[0], t]));
  let mismatches = 0;
  let lotsDiffer = 0;
  for (const c of computed) {
    const t = byTicket.get(c.ticket) as TradeRow;
    if (Math.abs(lotsFor(c.riskBase, t[5], t[6]) - t[4]) > TOLERANCE) lotsDiffer++;
    const diffs: string[] = [];
    if (c.profit !== null && Math.abs(c.profit - t[10]) > TOLERANCE) diffs.push(`profit ${c.profit} vs ${t[10]}`);
    if (c.r !== null && Math.abs(c.r - t[11]) > TOLERANCE) diffs.push(`r ${c.r} vs ${t[11]}`);
    if (c.balanceAfter !== null && Math.abs(c.balanceAfter - t[12]) > TOLERANCE) diffs.push(`balance ${c.balanceAfter} vs ${t[12]}`);
    if (diffs.length) {
      mismatches++;
      if (mismatches <= 5) console.log(`ticket ${t[0]} (scheme ${t[1]} ${t[2]}): ${diffs.join(', ')}`);
    }
  }
  const [schemes, trades] = await Promise.all([db.bookScheme.count(), db.bookTrade.count()]);
  console.log(`stored: ${schemes} schemes, ${trades} trades | €/R/balance mismatches above ${TOLERANCE} with the document's lots: ${mismatches} of ${computed.length} | rows whose lots differ from the 1 % proposal: ${lotsDiffer}`);
  await db.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
