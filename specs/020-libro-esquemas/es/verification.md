# 020 — Libro de esquemas EURUSD · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |
| 2 | `npm test` + `npm run build` | ✅ | 1 | 0,5 |
| 3 | `npm run build` + importación del documento real | ✅ | 1,25 | 1,5 |

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (número único, inicio / fin como DATE, `result` texto con `auto` por defecto, nota) y `book_trades` (ticket único, FK al esquema en cascada, posición, dirección, lotes, entrada, SL, hora de apertura, hora de cierre / precio de cierre / beneficio / R / saldo después anulables para las operaciones en curso, nota), índices por `start` y `schemeId`. Modelos Prisma `BookScheme` / `BookTrade` añadidos a `schema.prisma`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` lista exactamente las siete sentencias de la migración (dos tablas, dos índices únicos, dos índices, una clave foránea).
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Cálculos puros (backend)

- `src/book/calc.ts`: constantes del documento (10 000 de inicio, 1 % de riesgo, pip 0,0001, 10 por pip y lote), `pips` (con signo según dirección, 1 decimal), `lotsFor` (1 % del saldo previo ÷ pips de SL × 10, a 0,01), `figuresFor` (beneficio, R, saldo después; una operación en curso solo recibe sus lotes), `chain` (orden de ticket desde el saldo inicial, las operaciones en curso dejan el saldo intacto), `summaryOf` (la línea "T1 -1.0 · T2 +3.7" con "…" para una en curso, tickets, € y R netos, recuento de abiertas), `deriveResult` (Pendiente sin fin / sin operaciones / con una en curso; tablas dentro de ±0,5 R; si no la última operación con R ≥ 1,5; si no Pierde), `effectiveResult` (`auto` → derivado, si no el guardado), `totalsOf` (ganados / empates / perdidos / pendientes, % sobre los decididos, € y R netos).
- `npx vitest run src/book` → 10 pasados, sobre las dos primeras operaciones del documento (0,14 lotes / −102,2 / −1,02 / 9 897,8 y 0,24 / 369,6 / 3,73 / 10 267,4), la cadena, la línea de resumen, las cuatro reglas de resultado, los casos pendientes, la prioridad manual y los totales. `npm run build` y `npx eslint src/book` limpios.
- Est vs Real: 1 vs 0,5 SP.

## Tarea 3 — Repositorio e importador (backend)

- `src/book/repository.ts`: `listSchemes(year, page, pageSize)` (página + recuento + totales de toda la selección + años), `getScheme`, `nextSchemeNumber`, `createScheme` / `updateScheme` (409 con número ocupado) / `deleteScheme`, `nextTicket`, `createTrade` (lotes dados o propuestos), `updateTrade` (lotes null → se vuelven a proponer), `deleteTrade`, `recomputeAll` (€, R y saldo de cada fila desde sus propios lotes mediante `chain`, escribiendo solo las filas que cambian, en una transacción), `previewTrade`. `middleware/errors.ts` gana `HttpError` con `NotFound` (404) y `Conflict` (409). `scripts/import-book.ts`: extrae `const D = {…}`, hace upsert de esquemas por número y de operaciones por ticket (conservando lotes, €, R y saldo del documento), y después reproduce la cadena sobre las filas del documento e informa de las diferencias.
- La importación del documento real (migración aplicada antes a producción por el túnel) → 454 esquemas, 878 operaciones; una segunda ejecución no cambia nada. La comparación corrigió la aritmética dos veces: el saldo se encadena en **orden de cierre**, no de ticket (operaciones solapadas), y la R se mide contra el 1 % del saldo antes del cierre (0 discrepancias de R con esa regla, donde "saldo tras el ticket anterior" dejaba 154 y "saldo en la apertura" 128). Con los lotes del propio documento, € y R de 871 filas coinciden al céntimo; 7 filas llevan un € retocado a mano en el propio documento (p. ej. ticket 574: −1 876,6 guardado, −1 876,8 por sus lotes y pips), y los saldos posteriores heredan ese desfase (351 filas a unos pocos euros): el primer recálculo los realineará con la aritmética. 492 de 878 filas usan lotes distintos de la propuesta del 1 %, por eso los lotes siguen siendo del operador y editables. `npx vitest run src/book` → 12 pasados (dos tests de cadena sobre la regla de orden de cierre); build y lint limpios.
- Est vs Real: 1,25 vs 1,5 SP (las dos correcciones de la aritmética).
