# 017 · FE-02 — Cancelación de respuestas obsoletas

> Status: **closed**
> Origin: [auditoría frontend 2026-10-08](../../../reports/2026-10-08-frontend.md), mejora 2 (diagnóstico C)

## Contexto

Ningún efecto de carga del frontend cancela o descarta su petición cuando cambian sus entradas: hay cero `AbortController` en `src/` y solo tres banderas `cancelled` (`StatsPage`, `NewTradePanel`, `useBuildInfo`). En el resto, el orden de llegada decide el estado. En `ChartPage.tsx` afecta a velas (`:347-368`), dibujos (`:370-377`), símbolos (`:215-225`), el snapshot REST de posiciones (`:332-345`) y load-more (`:395-416`); en el journal, a `OpenPositions.tsx:57-77` (el snapshot REST puede pisar uno más nuevo del WebSocket) y `ClosedPositions.tsx:32-44`; en el scanner, a `useScanner.ts:43-60` (dos ejecuciones en vuelo, gana la más antigua si llega la última).

Los dibujos son el único caso que corrompe datos: cambiar rápido de EURUSD a GBPUSD puede dejar los dibujos de EURUSD cargados en el gráfico de GBPUSD y, como `saveDrawings` captura el broker/símbolo actuales (`:379-388`), cualquier edición hecha antes de que llegue la respuesta de GBPUSD persiste los dibujos de EURUSD bajo GBPUSD.

Junto a este código viven dos defectos relacionados. `LightweightChart` tiene su propio `isLoadingMoreRef` y solo lo resetea cuando un load-more entrega velas (`:714`); si la página viene vacía (`hasMore` pasa a false) o la petición falla, la bandera queda en `true` y el scroll infinito se bloquea hasta remontar el gráfico. Y al cambiar de broker nunca se re-elige símbolo: la guarda `if (!initSymbol)` de `ChartPage.tsx:221` es siempre falsa tras el montaje (el `eslint-disable` de `:224` lo tapa), así que un broker que no lista el símbolo actual muestra un gráfico vacío.

Esta spec cancela o descarta las respuestas obsoletas en esos puntos y corrige los dos defectos adyacentes. No introduce la capa compartida `apiFetch` (FE-03): el patrón se aplica sobre los `fetch` existentes para que FE-03 pueda migrarlos después con la cancelación ya en su sitio.

## Capas afectadas

- frontend

Sin cambios en backend, db, EA ni infra. Sin dependencias nuevas.

## Historias de usuario

- Como trader, quiero que el gráfico, los dibujos y las velas pertenezcan siempre al último símbolo que seleccioné, para que una secuencia rápida de cambios nunca muestre ni guarde datos del símbolo equivocado.
- Como trader, quiero que el scroll infinito del gráfico siga funcionando tras llegar a la vela más antigua o tras una carga fallida, para no tener que recargar la página para retroceder en el tiempo.
- Como trader, quiero que el gráfico elija un símbolo válido cuando cambio a un broker que no ofrece el actual, para no aterrizar nunca en un gráfico vacío.
- Como trader, quiero que el journal y el scanner muestren el resultado de mi último filtro o ejecución, para que una respuesta antigua y lenta nunca pise una más nueva.

## Criterios de aceptación

- AC 1. CUANDO cambia broker, símbolo o timeframe mientras hay una petición de velas, dibujos o símbolos en vuelo ENTONCES esa petición se aborta (o su resultado se descarta) y solo la respuesta que coincide con la selección actual llega al estado.
- AC 2. CUANDO el usuario edita dibujos tras un cambio de símbolo ENTONCES el payload guardado lleva siempre los dibujos cargados para el broker/símbolo/timeframe actual, nunca los de un símbolo anterior (verificado comparando `GET /drawings` de ambos símbolos antes y después de la prueba).
- AC 3. CUANDO una petición de load-more termina después de que cambiara broker, símbolo o timeframe ENTONCES sus velas se descartan en lugar de anteponerse a la serie nueva.
- AC 4. CUANDO una petición de load-more no devuelve velas o falla ENTONCES la guarda de load-more del gráfico se libera, y el siguiente scroll al borde izquierdo puede lanzar una nueva petición si `hasMore` sigue siendo true.
- AC 5. CUANDO cambia el broker y el símbolo actual no está en la lista del nuevo broker ENTONCES el gráfico selecciona EURUSD si existe y, si no, el primer símbolo de la lista; si el símbolo actual está en la lista, se conserva.
- AC 6. CUANDO cambia `positionsMode` o el broker en el gráfico mientras hay una petición a `/positions/live` en vuelo ENTONCES la respuesta obsoleta se descarta.
- AC 7. CUANDO `OpenPositions` del journal se desmonta, o llega un mensaje `positions` por WebSocket, antes que el snapshot REST de `/positions/live` ENTONCES el snapshot no pisa el estado más nuevo.
- AC 8. CUANDO cambia el rango de fechas del journal mientras hay una petición a `/trades` en vuelo ENTONCES la respuesta antigua se descarta y `loading` refleja solo la última petición.
- AC 9. CUANDO se vuelve a ejecutar el scanner mientras una ejecución anterior está en vuelo ENTONCES solo se muestra el resultado de la última y `loading` se apaga solo cuando termina la última.
- AC 10. CUANDO una petición se aborta ENTONCES el aborto en sí no produce toast de error, ni `setError`, ni reset de estado (un `AbortError` es silencioso).
- AC 11. CUANDO la implementación está completa ENTONCES `npx eslint .` y `npm run build` pasan en `frontend/`, y se elimina el `eslint-disable` del efecto de símbolos.

## Fuera de alcance

- Helper compartido `apiFetch<T>()`, `sendCommand`, gestión del 401 y vuelta al deep-link tras el login (FE-03).
- Hook compartido de posiciones, cachés de datos y refresco tras reconexión del WebSocket (FE-05).
- Optimizaciones de render por tick (FE-04).
- Cancelación en los tres sitios que ya tienen bandera `cancelled` (`StatsPage`, `NewTradePanel`, `useBuildInfo`): se quedan como están.
- Cargas de settings, chart-indicators y balances en `ChartPage` (solo al montar, sin entradas que cambien; pertenecen a la caché de FE-05).
