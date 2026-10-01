import { PrismaClient } from '@prisma/client';

// PRISMA_LOG=query prints every statement; used only to measure sync load locally.
const log = process.env['PRISMA_LOG'] === 'query' ? (['query'] as const) : [];

export const db = new PrismaClient({ log: [...log] });
