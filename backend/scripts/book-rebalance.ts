// One-off (2026-11-04): closed book operations whose lots deviate > 5 % from the
// 1 % rule. Imported history (ticket < 950): the stored SL is the final, moved one;
// the initial SL is rebuilt from the lots (1 % of the balance before the close), the
// final SL is kept in the note, € and balances stay. Operations entered in the app
// (ticket >= 950): lots set to the 1 % rule. Then the whole chain is recomputed.
// Dry run by default; APPLY=1 writes. Run from backend/: npx tsx scripts/book-rebalance.ts
import { db } from '../src/db/client';
import { lotsFor, START_BALANCE } from '../src/book/calc';
import { recomputeAll } from '../src/book/repository';

const FIRST_APP_TICKET = 950;
const apply = process.env.APPLY === '1';

async function main() {
  const rows = await db.bookTrade.findMany();
  const closed = rows
    .filter(r => r.closePrice !== null && r.closeTime !== null)
    .sort((a, b) => (a.closeTime as Date).getTime() - (b.closeTime as Date).getTime() || a.ticket - b.ticket);

  const slFixes: { id: number; ticket: number; sl: number; note: string }[] = [];
  const lotFixes: { id: number; ticket: number; lots: number }[] = [];
  let balance = START_BALANCE;
  for (const t of closed) {
    const proposed = lotsFor(balance, t.entry, t.sl);
    if (proposed > 0 && Math.abs(t.lots - proposed) / proposed > 0.05) {
      if (t.ticket < FIRST_APP_TICKET) {
        // A deliberately smaller position keeps its real SL.
        if (t.note && /riesgo (reducido|~)/i.test(t.note)) { balance = t.balanceAfter ?? balance; continue; }
        const impliedPips = Math.round((balance * 0.01) / (t.lots * 10));
        const sl = Number((t.direction === 'buy' ? t.entry - impliedPips * 0.0001 : t.entry + impliedPips * 0.0001).toFixed(4));
        const finalSl = `SL final ${t.sl}`;
        const note = t.note ? `${t.note} · ${finalSl}` : finalSl;
        slFixes.push({ id: t.id, ticket: t.ticket, sl, note });
      } else {
        lotFixes.push({ id: t.id, ticket: t.ticket, lots: proposed });
      }
    }
    balance = t.balanceAfter ?? balance;
  }

  console.log(`SL fixes: ${slFixes.length} · lot fixes: ${lotFixes.length}`);
  for (const f of slFixes) console.log(`  ${f.ticket}: sl -> ${f.sl} (${f.note})`);
  for (const f of lotFixes) console.log(`  ${f.ticket}: lots -> ${f.lots}`);
  if (!apply) { console.log('dry run: nothing written'); return; }

  await db.$transaction([
    ...slFixes.map(f => db.bookTrade.update({ where: { id: f.id }, data: { sl: f.sl, note: f.note } })),
    ...lotFixes.map(f => db.bookTrade.update({ where: { id: f.id }, data: { lots: f.lots } })),
  ]);
  const rechained = await recomputeAll();
  const last = await db.bookTrade.findFirst({ where: { closeTime: { not: null } }, orderBy: [{ closeTime: 'desc' }, { ticket: 'desc' }] });
  console.log(`applied: ${slFixes.length + lotFixes.length} rows · rechained: ${rechained} · final balance: ${last?.balanceAfter}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => db.$disconnect());
