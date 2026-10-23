# 019 · FE-04 — Renderizado por tick · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | manual (contador de renders en la consola, ventanas de 10 s) | ✅ | 0,5 | 0,25 |
| 2 | `npm run build` + `npx eslint .` + contador + app local (usuario) | ✅ | 0,75 | 0,75 |
| 3 | `npm run build` + `npx eslint .` + app local (usuario) | ✅ | 1 | 0,75 |
| 4 | `npm run build` + `npx eslint .` + app local (usuario) | ✅ | 0,75 | 0,5 |
| 5 | — (anulada: el Scanner se retiró en la spec 022) | — | 0,5 | 0 |
| 6 | `npm run build` + `npx eslint .` + contador + app local (usuario) | ✅ | 0,75 | 1 |

Desviación de medida: el Profiler de React DevTools no se podía manejar desde el lado del operador, así que un hook temporal `useRenderRate(nombre)` (no commiteado) contó los renders de `ChartPage`, `LightweightChart` y `JournalPage` y escribió renders/s en la consola del navegador cada 10 s; el usuario leyó las líneas. Misma unidad que los objetivos de la spec.

## Tarea 1 — Línea base (frontend)

- App local (Vite 5174 contra la API de producción, con ticks, 23-10-2026), ventanas de 10 s en reposo:

| Página | Componente | Antes |
|---|---|---|
| `/chart`, panel de alertas cerrado | `ChartPage` | 13,2–14,4 renders/s |
| `/chart`, panel de alertas cerrado | `LightweightChart` | 12,8–17,6 renders/s |
| `/journal`, Positions | `JournalPage` | 12,8–22,2 renders/s (12 brokers, posiciones en casi todos) |

- La página del scanner ya no existe (spec 022), así que no tiene línea base.
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Vela viva fuera del estado de página (frontend)

- `LightweightChart`: `export interface ChartHandle { updateLive(vela | null) }`, prop `ref?: Ref<ChartHandle>` (React 19 pasa `ref` como prop) expuesta con `useImperativeHandle`; `updateLive` es el antiguo efecto de la vela viva como `useCallback` (lee `seriesRef` / `candlesRef`, `null` limpia `liveCandleTimeRef`); desaparecen la prop `liveCandle` y su efecto. `ChartPage`: `chartRef` + `liveCandleRef`; el manejador WS construye la vela, la guarda y llama a `updateLive`; el efecto de velas reinicia ambos al cambiar la selección; el estado `panelPrice` solo se alimenta con el panel de alertas abierto y lo siembra `toggleAlerts` al abrirlo (CA 1, 2).
- Hallazgo por el camino: el gráfico lanza `crosshairMove` también en cada actualización de datos y el componente guardaba un objeto OHLC nuevo cada vez → `LightweightChart` seguía a 10–12 renders/s con `ChartPage` en 0. `setHoverOhlc` conserva ahora el estado anterior cuando el OHLC bajo el cursor no cambia.
- Después: `ChartPage` 0 renders/s, `LightweightChart` 0,4 renders/s con el panel cerrado; la vela se mueve tras cambiar par / timeframe (un `ref` obsoleto tras la recarga en caliente de Vite necesitó una recarga completa, no un fallo de código); el precio del panel de alertas se mueve mientras está abierto. Validado por el usuario.
- Est vs Real: 0,75 vs 0,75 SP.

## Tarea 3 — Posiciones solo cuando cambian (frontend)

- `ChartPage`: `positionsSignature` (ticket, tipo, lotes, apertura, SL, TP, beneficio) con `acceptPositions` filtrando `setPositions` tanto para el mensaje WS como para la instantánea REST; mensajes `positions` ignorados en modo `none`; la firma se limpia en el efecto de posiciones cuando el modo es `none` o no hay broker. Efecto de posiciones de `LightweightChart`: líneas de precio reconciliadas (línea existente → `applyOptions` con precio, color, grosor y estilo; nueva → `createPriceLine`; ids no vistos → `removePriceLine`), plugin de marcadores reconstruido solo cuando cambia la clave `time|shape`; ambos se reinician al destruir el gráfico (CA 3–6).
- Comprobación del usuario: las líneas conservan su identidad entre actualizaciones (sin parpadeo), SL arrastrado con ticks, el resaltado de selección sobrevive a una actualización. Validado por el usuario.
- Est vs Real: 1 vs 0,75 SP.

## Tarea 4 — Paneles memorizados y manejadores estables (frontend)

- `memo` en `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `ChartToolbar`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel` (`export const X = memo(function X …)`); manejadores de `ChartPage` como `useCallback` (`openIndicators`, `closeIndicators`, `openFilters`, `closeFilters`, `toggleAlerts`, `closeAlerts`, `toggleDrawMode`, `clearDrawMode`, `cyclePositions`, `openNewTrade`, `closeNewTrade`, `clearEdit`, `clearClose`) y `editPositions` memorizado (CA 7).
- Comprobación del usuario: cada panel refleja un cambio de broker / par. Validado por el usuario.
- Est vs Real: 0,75 vs 0,5 SP.

## Tarea 5 — Scanner (anulada)

- La página, el hook y la ruta del Scanner se retiraron en la spec 022 antes de empezar esta tarea; nada que hacer. Registrado como desviación acordada, CA 8 sin efecto.

## Tarea 6 — Journal: flujo en vivo fuera del estado de página (frontend)

- `useLivePositions.ts` reescrito como almacén externo (`useSyncExternalStore`): `useLivePositionsFeed()` montado por `JournalPage` ejecuta la instantánea REST + la fusión WS en una instantánea de módulo con filtro de firma por broker y `openedAt` precalculado por un `normalize` compartido; `useLivePositions()` suscribe un componente a posiciones + colores; `useLivePositionsByKeys(claves)` da a un panel de editar / cancelar sus filas en vivo con un selector cacheado; `setLiveColor` actualiza el mapa de colores. `OpenPositions` y `PendingOrders` se suscriben ellos mismos y filtran mercado / pendientes; su `onOptionsChange` solo dispara cuando cambia la clave de opciones y `onBulkChange` / `onGroupChange` solo cuando cambian los tickets o el SL / TP (CA 9). `Accounts`: el sondeo del P&L diario se detiene con la pestaña oculta y se reanuda con una petición inmediata al mostrarla (CA 10).
- Después: `JournalPage` 2,8 renders/s en los primeros 10 s (carga) y 0 renders/s en los 40 s siguientes; Positions y Orders siguen actualizándose en vivo, colores e insignia de grupo funcionan, los paneles de orden muestran la distancia moviéndose. Validado por el usuario.
- Est vs Real: 0,75 vs 1 SP (+0,25: la estructura de la 021 puso el flujo en la página, así que hizo falta el almacén para llegar a 0 renders/s).
