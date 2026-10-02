# 013 · BE-07 — Corrección del sizing por % de riesgo · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `getPipSize`: símbolo no listado con cotizada JPY → 0,01 (`pip-size.test.ts`, 2 tests; pares listados sin cambios). `sizing.ts`: `calculateLots(SizingInput): SizingResult` — par = seis primeras letras, ambas divisas en el conjunto de 8 o `not_forex`; `slPips` desde `entryPrice`; cero → `zero_stop`; conversión directa/inversa (clave exacta, luego con sufijo) o `no_conversion`. `sizing.test.ts` reescrito, 11 tests: los cinco tamaños que no cambian (0,5 / 0,75 / 0,5 / 0,3 / suelo 0,01 y 0,3), orden pendiente a 20 pips de su propio precio → 0,5 frente a 0,07 desde el bid, las tres negativas con sus mensajes exactos, `EURUSD.r` y minúsculas, conversión bajo `USDJPY.r`. `commands.ts`: `entryPrice: price \|\| bid`, negativa → 503 (`no_conversion`) o 400. **80/80** en verde; lint 0; typecheck 0; build ok. Comprobado que el frontend solo envía `price` en acciones pendientes (`NewTradePanel.tsx:203`). El mapeo HTTP no se ejercita en local (sin pipe → sin ticks/cuenta en memoria); se ve por primera vez en la tarea 2. | 1,25 | 0,75 | — |
| 2 | manual (comprobaciones del operador + validación del usuario en producción) | push `707ef17..4eb01d9` (backend 182); `/version`, `/health`, `pm2 jlist`; órdenes del usuario en FTMO (cuenta EUR, balance ≈ 77 492 €) | ✅ (dos rechazos sin ejercitar) | Deploy ok: VPS en `4eb01d9`, pm2 online, reinicios 0. **(a) mercado, riesgo 0,1 %**: buy EURUSD, SL 1,11500 desde un bid ≈ 1,1251 (≈ 101 pips) → 77,49 € / (101 × 8,89 €) = 0,086 → abierta con **0,09 lotes**, ticket #49173624 (AC 1, 2: conversión USD→EUR vía EURUSD). **(b) pendiente**: buy limit 1,12200, SL 1,11190 (101 pips desde su propio precio) → **0,09 lotes**; el código antiguo, midiendo 133 pips desde el bid, habría enviado 0,07 (AC 1). Lotes fijos sin cambios: buy 0,8 fijo ejecutada, ticket #49173567 (AC 7). **(c) no forex** y **(d) SL igual a la entrada** no se pudieron provocar desde la UI: la lista de símbolos solo ofrece lo que envía el EA (solo forex) y la ruta responde `Tick data not available yet` antes del sizing para cualquier símbolo sin ticks, así que `not_forex` es inalcanzable con los símbolos actuales del EA; (d) no se intentó. Ambos rechazos están cubiertos por los tests unitarios de la tarea 1; su mapeo HTTP (6 líneas, con typecheck) **no se ha observado en producción**. | 0,5 | 0,5 | Leí mal al principio el SL de la orden (a) como 1,12000 por una línea del gráfico (esperaba 0,17 lotes); la fila de la posición mostraba 1,11500 y el tamaño era correcto. |
| 3 | manual | `Status: closed`; `git mv` a `archive/2026-10/`; columna `Spec` de BE-07 → `013 ✅` | ✅ | — | 0,25 | 0,25 | — |
| **Total** | | | | | **2** | **1,5** | 0,5 SP por debajo: un módulo puro pequeño con sus tests ya montados desde la spec 008. |

## Desviaciones acordadas durante la implementación

- Los rechazos `not_forex` y `zero_stop` no se ejercitaron en producción (inalcanzable / poco práctico desde la UI); cerrado por decisión del usuario con los tests unitarios como evidencia.

## Incidente durante esta spec (no causado por ella)

Dos bugchecks de Windows `0x1A (0x3F)` en el VPS a las 08:42:44 y 08:52:23 UTC, el primero ~6 min después de este deploy, el segundo durante el arranque simultáneo de los terminales MT4. Hardware (fallo de checksum al leer una página del pagefile), con los picos de memoria como detonante probable. No se hicieron más deploys después; la máquina estuvo estable 33 min antes de reanudar la validación.

## Pendiente del usuario

- Abierto en FTMO por las pruebas: buy 0,8 (#49173567), buy 0,09 (#49173624) y el buy limit de 0,09 en 1,12200.
- Ticket a IONOS con los dos bugchecks del 2026-10-02; decidir si se compila en CI para que el VPS deje de compilar en el deploy.
