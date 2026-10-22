# 020 — Libro de esquemas EURUSD · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (número único, inicio / fin como DATE, `result` texto con `auto` por defecto, nota) y `book_trades` (ticket único, FK al esquema en cascada, posición, dirección, lotes, entrada, SL, hora de apertura, hora de cierre / precio de cierre / beneficio / R / saldo después anulables para las operaciones en curso, nota), índices por `start` y `schemeId`. Modelos Prisma `BookScheme` / `BookTrade` añadidos a `schema.prisma`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` lista exactamente las siete sentencias de la migración (dos tablas, dos índices únicos, dos índices, una clave foránea).
- Est vs Real: 0,5 vs 0,25 SP.
