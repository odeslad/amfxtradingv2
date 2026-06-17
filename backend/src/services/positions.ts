import { db } from '../db/client';
import type { BridgePosition } from '../bridge/file-watcher';

export async function syncPositions(broker: string, positions: BridgePosition[]) {
  const incomingTickets = positions.map((p) => p.ticket);

  await db.$transaction(async (tx) => {
    await tx.position.deleteMany({
      where: { broker, ticket: { notIn: incomingTickets } },
    });

    for (const p of positions) {
      await tx.position.upsert({
        where: { ticket: p.ticket },
        update: { profit: p.profit, swap: p.swap, sl: p.sl, tp: p.tp },
        create: {
          ticket: p.ticket, broker, symbol: p.symbol,
          type: p.type, lots: p.lots, openPrice: p.openPrice,
          sl: p.sl, tp: p.tp, profit: p.profit, swap: p.swap,
          commission: p.commission, magic: p.magic,
          comment: p.comment, openTime: new Date(p.openTime),
        },
      });
    }
  });
}
