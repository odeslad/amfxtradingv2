import { db } from '../db/client';

const prevTickets = new Map<string, Set<number>>();

export async function syncColors(broker: string, tickets: number[]) {
  const current = new Set(tickets);
  const prev = prevTickets.get(broker);

  if (prev) {
    const closed = [...prev].filter(t => !current.has(t));
    if (closed.length > 0) {
      await db.positionColor.deleteMany({ where: { broker, ticket: { in: closed } } });
    }
  }

  prevTickets.set(broker, current);
}

export async function setColor(broker: string, ticket: number, color: string) {
  if (!color) {
    await db.positionColor.deleteMany({ where: { broker, ticket } });
  } else {
    await db.positionColor.upsert({
      where: { broker_ticket: { broker, ticket } },
      create: { broker, ticket, color },
      update: { color },
    });
  }
}

export async function getColorsByBroker(broker: string): Promise<Map<number, string>> {
  const rows = await db.positionColor.findMany({ where: { broker } });
  return new Map(rows.map(r => [r.ticket, r.color]));
}

export async function getAllColors(): Promise<Map<string, string>> {
  const rows = await db.positionColor.findMany();
  return new Map(rows.map(r => [`${r.broker}:${r.ticket}`, r.color]));
}
