// Read-only: every closed book operation whose lots deviate > 5 % from the 1 % rule,
// with the correction the agreed rule would apply: imported history (ticket < 950)
// keeps lots and € and gets the SL the lots imply (R changes); operations entered
// in the app (ticket >= 950) keep the SL and get the 1 % lots (€ and balances change).
// Run from backend/: npx tsx scripts/book-rebalance-report.ts
import { db } from '../src/db/client';
import { figuresFor, lotsFor, pips, round2, slPips, START_BALANCE, type Direction } from '../src/book/calc';

const FIRST_APP_TICKET = 950;

async function main() {
  const rows = await db.bookTrade.findMany({ include: { scheme: { select: { number: true } } } });
  const closed = rows
    .filter(r => r.closePrice !== null && r.closeTime !== null)
    .sort((a, b) => (a.closeTime as Date).getTime() - (b.closeTime as Date).getTime() || a.ticket - b.ticket);

  let balance = START_BALANCE;
  let deviating = 0;
  console.log('| Ticket | Esq. | Pos. | Cierre | Lotes | SL pips | R | € | Corrección | SL pips | Lotes | R | € | Saldo |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of closed) {
    const dir = t.direction as Direction;
    const proposed = lotsFor(balance, t.entry, t.sl);
    const deviates = proposed > 0 && Math.abs(t.lots - proposed) / proposed > 0.05;
    let next = t.balanceAfter as number;
    if (deviates) {
      deviating++;
      const close = (t.closeTime as Date).toISOString().slice(0, 10);
      const before = `| ${t.ticket} | ${t.scheme.number} | ${t.slot} | ${close} | ${t.lots} | ${slPips(t.entry, t.sl)} | ${t.r} | ${t.profit} |`;
      if (t.ticket < FIRST_APP_TICKET) {
        const impliedPips = Math.round((balance * 0.01) / (t.lots * 10));
        const newSl = round2(0) + Number((dir === 'buy' ? t.entry - impliedPips * 0.0001 : t.entry + impliedPips * 0.0001).toFixed(4));
        const gained = pips(dir, t.entry, t.closePrice as number);
        const newR = round2(gained / impliedPips);
        console.log(`${before} SL → ${newSl} | ${impliedPips} | ${t.lots} | ${newR} | ${t.profit} | ${t.balanceAfter} |`);
      } else {
        const f = figuresFor(balance, { direction: dir, entry: t.entry, sl: t.sl, closePrice: t.closePrice }, proposed);
        next = round2(balance + (f.profit as number));
        console.log(`${before} lotes → ${proposed} | ${slPips(t.entry, t.sl)} | ${proposed} | ${f.r} | ${f.profit} | ${next} |`);
      }
    } else if (t.ticket >= FIRST_APP_TICKET) {
      // Downstream of a lots fix the balance chain moves even for untouched rows.
      const f = figuresFor(balance, { direction: dir, entry: t.entry, sl: t.sl, closePrice: t.closePrice }, t.lots);
      next = round2(balance + (f.profit as number));
    }
    balance = next;
  }
  console.log(`\nclosed: ${closed.length} · deviating > 5 %: ${deviating} · final balance after the fixes: ${balance}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => db.$disconnect());
