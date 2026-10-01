// Insert batches of this size so Prisma never serializes a full history in one query.
export const CHUNK_SIZE = 5_000;

export function* chunks<T>(items: T[], size = CHUNK_SIZE): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
