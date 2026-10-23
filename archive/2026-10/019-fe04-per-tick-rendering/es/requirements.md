# 019 · FE-04 — Render por tick

> Estado: **cerrada**
> Origin: [auditoría frontend 2026-10-08](../../../reports/2026-10-08-frontend.md), mejora 4 (diagnósticos D, E)

## Contexto

Cada tick del WebSocket acaba en estado React a nivel de página, así que páginas enteras se re-renderizan al ritmo de ticks del broker. En `/chart`, cada batch `ticks` del broker seleccionado llama a `setLiveCandle` (`ChartPage.tsx:296-302`), que re-renderiza la página unas diez veces por segundo con todo lo montado debajo: toolbar, `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `NewTradePanel`, `BulkEditPanel` (que además recibe un array `[editPosition]` nuevo en cada render), `ClosePositionPanel` y `LightweightChart`, cuyo único uso del valor es un `series.update` dentro de un efecto (`LightweightChart.tsx:736-766`). El mensaje `positions` se guarda cada segundo aunque `positionsMode` sea `none` (`ChartPage.tsx:281-288`), y cada array nuevo hace que el efecto de posiciones del gráfico (`LightweightChart.tsx:768-865`) borre y recree todas las líneas de precio y el plugin de markers, recorriendo el histórico de velas hacia atrás por posición.

En `/journal`, las tres pestañas siguen montadas (ocultas por CSS). `OpenPositions` guarda cada mensaje `positions`, ordenando con `openTimeMs(...)`, un parseo de fecha, dentro del comparador, y después llama a `onOptionsChange` con arrays nuevos en cada cambio, así que `JournalPage` se re-renderiza con sus tres pestañas. `Accounts` sondea `/balances/daily-pnl` cada cinco segundos aunque la pestaña esté oculta. En `/scanner`, cada batch de ticks copia el objeto `bids` entero (`ScannerPage.tsx:181-189`), y los bids del broker anterior sobreviven a un cambio de broker.

Hay cero `React.memo` y cero `useSyncExternalStore` en el código. Esta spec saca el precio vivo y las posiciones vivas del estado de página donde no necesitan estar, deja de reconstruir objetos del gráfico que no han cambiado y hace que los paneles se salten renders cuyas props no cambiaron. Mide el resultado con el React Profiler: en reposo (sin interacción, con ticks fluyendo) las páginas no deben re-renderizarse.

## Capas afectadas

- frontend

Sin cambios en backend, db, EA ni infra. Sin dependencias nuevas.

## Historias de usuario

- Como trader, quiero que la página del gráfico siga respondiendo mientras fluyen los ticks (paneles abiertos, dibujando, haciendo pan), para que la UI nunca dé tirones al ritmo de ticks del broker.
- Como trader, quiero que las líneas de posición del gráfico se queden quietas mientras se actualiza el P&L, para que una línea que estoy mirando (o arrastrando) no se destruya y recree cada segundo.
- Como trader, quiero que el journal y el scanner actualicen solo los números que cambiaron, para que las páginas sigan siendo baratas con doce brokers emitiendo.
- Como trader, quiero que la app deje de sondear mientras la pestaña está oculta, para que una pestaña en segundo plano no gaste red ni batería.

## Criterios de aceptación

- AC 1. CUANDO llegan ticks del broker y símbolo seleccionados ENTONCES la vela viva del gráfico se actualiza al ritmo de ticks y `ChartPage` no se re-renderiza por ello (React Profiler: 0 renders de `ChartPage` por segundo en reposo con el panel de alertas cerrado).
- AC 2. CUANDO el panel de alertas está abierto ENTONCES muestra el precio actual como hoy; CUANDO está cerrado ENTONCES ningún tick le llega y no se re-renderiza.
- AC 3. CUANDO llega un mensaje `positions` y `positionsMode` es `none` ENTONCES se ignora (sin actualización de estado, sin ejecución de efecto).
- AC 4. CUANDO llega un mensaje `positions` con las mismas posiciones (mismo ticket, tipo, lotes, precio de apertura, SL, TP, beneficio) que el anterior ENTONCES no hay actualización de estado.
- AC 5. CUANDO cambian las posiciones (una nueva, una cerrada, SL/TP movido, beneficio cambiado) ENTONCES las líneas de precio existentes se actualizan en el sitio con `applyOptions`, solo se crean las nuevas y se eliminan las desaparecidas; el plugin de markers se reconstruye solo cuando cambia el conjunto de entradas (ticket + hora de apertura).
- AC 6. CUANDO se está arrastrando un nivel y llega una actualización de `positions` ENTONCES el arrastre continúa sobre el mismo objeto de línea (sin parpadeo, sin perder el arrastre).
- AC 7. CUANDO `ChartPage` se re-renderiza por un motivo legítimo (cambio de selección, abrir/cerrar un panel) ENTONCES los paneles cuyas props no cambiaron (`AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel`, `ChartToolbar`) se saltan su render; los handlers que reciben son referencialmente estables y `BulkEditPanel` recibe un array de posiciones memoizado.
- AC 8. CUANDO llegan batches de ticks en `/scanner` ENTONCES los bids se acumulan fuera del estado React y se vuelcan como mucho una vez por frame de animación, y solo si cambió al menos un valor; CUANDO cambia el broker ENTONCES el mapa de bids se vacía.
- AC 9. CUANDO llega un mensaje `positions` en `/journal` ENTONCES `OpenPositions` ordena con un número de hora de apertura precalculado (sin parseo de fecha en el comparador) y llama a `onOptionsChange` solo cuando los conjuntos de brokers, símbolos o colores difieren de verdad, de modo que `JournalPage` no se re-renderiza con los ticks (Profiler: 0 renders de `JournalPage` por segundo en reposo).
- AC 10. CUANDO el documento está oculto ENTONCES el sondeo de P&L diario de `Accounts` se detiene; CUANDO vuelve a estar visible ENTONCES hace una petición inmediata y reanuda el intervalo.
- AC 11. CUANDO la implementación está completa ENTONCES `npx eslint .` y `npm run build` pasan en `frontend/`, y la app en producción se comporta como antes en `/chart` (vela viva, leyenda, líneas y etiquetas de posiciones, arrastre de SL/TP, precio del panel de alertas, bid de New Trade), `/journal` (P&L vivo, filtros, bulk) y `/scanner` (distancias vivas).

## Fuera de alcance

- `useLivePositions` compartido / provider de datos / unión tipada del WS (FE-05).
- Partir `LightweightChart` y `ChartPage` en hooks, caché de rollovers, `devicePixelRatio` en canvas, rAF solo cuando algo cambia (FE-11).
- `SidePanel` compartido (FE-07) y primitivas UI (FE-12).
- Una librería de gestión de estado o un store global: los cambios usan refs, `useSyncExternalStore` donde hace falta una suscripción y `React.memo`.
- Reducir el ritmo de ticks del broker o la cadencia de `positions` del backend.
