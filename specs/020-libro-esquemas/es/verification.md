# 020 — Libro de esquemas EURUSD · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |
| 2 | `npm test` + `npm run build` | ✅ | 1 | 0,5 |

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (número único, inicio / fin como DATE, `result` texto con `auto` por defecto, nota) y `book_trades` (ticket único, FK al esquema en cascada, posición, dirección, lotes, entrada, SL, hora de apertura, hora de cierre / precio de cierre / beneficio / R / saldo después anulables para las operaciones en curso, nota), índices por `start` y `schemeId`. Modelos Prisma `BookScheme` / `BookTrade` añadidos a `schema.prisma`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` lista exactamente las siete sentencias de la migración (dos tablas, dos índices únicos, dos índices, una clave foránea).
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Cálculos puros (backend)

- `src/book/calc.ts`: constantes del documento (10 000 de inicio, 1 % de riesgo, pip 0,0001, 10 por pip y lote), `pips` (con signo según dirección, 1 decimal), `lotsFor` (1 % del saldo previo ÷ pips de SL × 10, a 0,01), `figuresFor` (beneficio, R, saldo después; una operación en curso solo recibe sus lotes), `chain` (orden de ticket desde el saldo inicial, las operaciones en curso dejan el saldo intacto), `summaryOf` (la línea "T1 -1.0 · T2 +3.7" con "…" para una en curso, tickets, € y R netos, recuento de abiertas), `deriveResult` (Pendiente sin fin / sin operaciones / con una en curso; tablas dentro de ±0,5 R; si no la última operación con R ≥ 1,5; si no Pierde), `effectiveResult` (`auto` → derivado, si no el guardado), `totalsOf` (ganados / empates / perdidos / pendientes, % sobre los decididos, € y R netos).
- `npx vitest run src/book` → 10 pasados, sobre las dos primeras operaciones del documento (0,14 lotes / −102,2 / −1,02 / 9 897,8 y 0,24 / 369,6 / 3,73 / 10 267,4), la cadena, la línea de resumen, las cuatro reglas de resultado, los casos pendientes, la prioridad manual y los totales. `npm run build` y `npx eslint src/book` limpios.
- Est vs Real: 1 vs 0,5 SP.
