# 020 — Libro de esquemas EURUSD · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |
| 2 | `npm test` + `npm run build` | ✅ | 1 | 0,5 |
| 3 | `npm run build` + importación del documento real | ✅ | 1,25 | 1,5 |
| 4 | `npm run build` + backend local | ✅ | 1 | 0,75 |
| 5 | manual (evidencia del despliegue) | ✅ | 0,5 | 0,25 |
| 6 | `npm run build` + `npm run lint` + app local (usuario) | ✅ | 1,5 | 1 |

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

## Tarea 4 — Rutas y documentación (backend)

- `src/routes/book.ts` montado en `/book` tras `requireAuth` (17 routers): `GET /schemes?year=YYYY|all&page&pageSize` (año por defecto = el último; devuelve la página, `total`, los totales de toda la selección, `years`, `year`, `nextNumber`), `POST /schemes` (número opcional → siguiente; `result` `auto` por defecto), `GET|PUT|DELETE /schemes/:id`, `POST /trades` (lotes opcionales → propuestos; hora y precio de cierre van juntos o faltan ambos), `PUT|DELETE /trades/:id`, `POST /preview`. Las fechas aceptan el `YYYY-MM-DD HH:MM` del documento o ISO, leídas como UTC. `deriveResult` ganó una regla descubierta al probar: un neto positivo sin ninguna operación en su objetivo lo gana la mejor operación (el documento no tiene ningún caso así). Docs: `architecture.md` (`book/` en el árbol, fila de ruta `/book`, sección "Libro de esquemas (book)"), `.claude/CLAUDE.md` (17 routers, modelos).
- `npm run build`, `npx eslint src/book src/routes/book.ts src/app.ts` limpios; `npx vitest run src/book` → 12 pasados (la regla nueva se cubre dentro del test de resultado existente).
- Backend local en 3001 contra los datos de producción (BD por el túnel): listado sin `year` → 2026, 25 esquemas, totales 18 / 1 / 6 / 72 % / 150 740,76 / +23,26 R, primer esquema 454 con su resumen; `year=all` → 454 esquemas, totales 346 / 7 / 101 / 76 % / 745 026,05 / +449,12 R (la cabecera del documento); crear esquema sin número → 455 `Pendiente`; crear 455 de nuevo → 409; previsualización de una operación en curso → ticket 950, base de riesgo 755 026,05, lotes 25,17; crear la operación cerrada → lotes 25,17, 60 pips, 15 102 €, 2 R, saldo 770 132,90; editar el precio de cierre → 40 pips, 10 068 €, 1,33 R; el resumen del esquema lo sigue (`T1 +1.3`); poner el fin → resultado derivado; borrar operación y esquema → 204 / 204 / 404. Efecto anotado: la primera escritura ejecutó `recomputeAll`, que realineó las 7 filas retocadas a mano del documento y los saldos posteriores (ticket 949 ahora 14 839,20 € / 755 030,90 en vez de 14 837,51 / 755 026,05).
- Est vs Real: 1 vs 0,75 SP.

## Tarea 5 — Despliegue del backend (infra)

- Push de `master` (`cb4dce1` … `cdd4e62`) el 23-10-2026; el pipeline del backend desplegó la build 191 a las 00:27 (`/version` `{ backend: 191 }`, `/health` con los pipes conectados). La migración se había aplicado por el túnel en la tarea 3, así que el `migrate deploy` del pipeline no encontró nada pendiente; `prisma migrate diff --from-url <producción> --to-schema-datamodel` tras el despliegue → "No difference detected". El libro está en producción (454 esquemas, 878 operaciones, importados en la tarea 3 y leídos por las comprobaciones de la tarea 4 contra la misma base de datos: 2026 → 25 esquemas, totales 18 / 1 / 6 / 72 % / 150 740,76 € / +23,26 R; todos → 454, 346 / 7 / 101 / 76 % / 745 026,05 € / +449,12 R, la cabecera del documento).
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 6 — Página Schemas: totales, filtro de año, tabla y paginación (frontend)

- `src/lib/book.ts` (tipos, las nueve llamadas API, `fmtEur` / `fmtR` / `fmtR1` / `fmtPrice` / `fmtPips` / `fmtDateTime` / `fmtShort` sobre el reloj sin zona del libro, `resultLabel` / `resultTone`), `features/book/useBook.ts` (estado de año / página / tamaño, una carga bajo `AbortController`, mutaciones que recargan), `BookPage.tsx` + `.module.css` (barra superior con selector de año y **Nuevo esquema**, siete tiles de totales con "n en curso" cuando hay esquemas pendientes, barra de paginación 25 / 50 / 100 con "Esquemas 1–25 de 454"), `SchemesTable.tsx` + `.module.css` (las columnas del documento, insignias de resultado en verde / rojo / dorado / gris, una fila se despliega a su tabla de operaciones con ticket, posición, dirección, lotes, entrada, SL, apertura, cierre o "en curso", precio, pips, €, R, saldo, nota y acciones por fila; tarjetas bajo 768 px). Ruta `/schemas`, entrada **Schemas** con `IconBook`. Los manejadores de alta / edición / borrado muestran un toast hasta los paneles de la tarea 7.
- `npm run build` y `npm run lint` limpios.
- App local (backend 3001 contra la base de datos de producción por el túnel, Vite 5174): la página mostró 2026 por defecto con 25 esquemas, totales 18 / 1 / 6 / 72 % / 150 744,60 / +23,26 R y la tabla del 454 hacia abajo con las líneas de trades, tickets, resultados y netos del documento; confirmado por el usuario con una captura. (Los € difieren de la cabecera del documento en 3,84 € porque la escritura de prueba de la tarea 4 realineó sus siete filas retocadas a mano.)
- Est vs Real: 1,5 vs 1 SP.
