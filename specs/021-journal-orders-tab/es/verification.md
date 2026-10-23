# 021 — Pestaña Orders en el Journal · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | manual (lectura) + compilación local con MetaEditor | ✅ | 0,5 | 0,25 |
| 2 | manual (script contra una copia rota y contra los ficheros reales) | ✅ | 0,5 | 0,5 |
| 3 | `npm run build` + `npm run lint` + app local contra producción (usuario) | ✅ | 1,5 | 1 |
| 4 | `npm run build` + `npm run lint` + app local contra producción (usuario) | ✅ | 2 | 1,75 |

## Tarea 1 — `modify` mueve una orden pendiente al precio recibido (ea)

- Rama `modify` de `HttpBridgeCommands.mq4`: tras `OrderSelect`, `isPending = OrderType() >= OP_BUYLIMIT` y `newPrice = (isPending && price > 0) ? price : OrderOpenPrice()`; `OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. `price` ya se extraía al principio de `ExecuteCommand` (línea 65), así que un `modify` sin él queda en 0 y conserva el precio de apertura; las posiciones de mercado (tipos 0 / 1) lo conservan lleve lo que lleve el comando. La línea de log OK imprime ahora el precio. Versión 2.22 en `#property version` y en el banner de arranque. `ea/docs/HttpBridgeCommands.md`: campo `price` y fila `modify` actualizados.
- Lectura: la rama sigue las convenciones `ExtractField` / `ResultError` / `ResultOk(-1, id)` de `close` y `modify`; una modificación rechazada (130 stops inválidos, 4107 precio inválido, 1 sin cambios) vuelve por `ResultError` como antes. Compilado en local al probar la tarea 2 (MetaEditor de Darwinex MT4): `Result: 0 errors, 0 warnings` en ambos ficheros, así que el fuente 2.22 es válido antes del push; el VPS lo vuelve a compilar en la tarea 7.
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — `compile-ea.ps1` hace fallar el workflow si la compilación falla (ea)

- Reescrito: parámetros `-SourceDir` / `-Files` (valores por defecto sin cambios: `C:amfxtradingv2ea`, ambos fuentes); por fichero borra el log anterior, ejecuta MetaEditor `/compile /log`, imprime las líneas de error / warning / `Result:` del log UTF-16 y marca el fichero como **fallido** cuando no existe `.ex4`, el `.ex4` es anterior a la ejecución o la línea `Result:` del log reporta errores; al final `exit 1` nombrando los ficheros fallidos, si no `exit 0`. `ea/docs/deploy.md` actualizado.
- Hallazgo por el camino: el código de salida de MetaEditor es **1 al compilar bien y 0 al fallar**, así que el "código ≠ 0 → aviso" del script antiguo estaba invertido y nunca fue una señal; la comprobación es el `.ex4` y el log.
- Ejecuciones (MetaEditor local de Darwinex MT4): fuentes reales → ambos `[OK]`, `Result: 0 errors, 0 warnings`, salida 0. Copia con `this is not mql4 ;` añadido a `HttpBridgeCommands.mq4` → tres líneas `error` y `Result: 3 errors` impresas, `[FAILED] HttpBridgeCommands.mq4 : no .ex4 produced`, el otro fichero OK, `Compilation failed for: HttpBridgeCommands.mq4`, salida 1.
- Est vs Real: 0,5 vs 0,5 SP.

## Tarea 3 — Flujo en vivo compartido, hook de deslizar, helpers de pips; Positions sin la sección de pendientes (frontend)

- `features/journal/useLivePositions.ts`: la instantánea REST de `/positions/live`, la fusión del `positions` del WebSocket (los brokers ya refrescados por el WS no los pisa una instantánea tardía) y el mapa de colores con `setColor`, sacados de `OpenPositions` y llamados una vez en `JournalPage`, que pasa `positions.filter(!isPending)` a Positions. `utils/useSwipeActions.ts`: los gestos de la tarjeta (deslizar izquierda / derecha, toque, doble toque) desde `PositionCard`, que ahora usa el hook. `utils/position.ts`: `pipSize(símbolo)` (también lo usa `calcPnl`) y `orderDistancePips(p)` para la tarea 4. `OpenPositions` recibe `positions` / `colors` / `onColorChange` por props y pierde el fetch, el WS, el estado de colores, la tabla y tarjetas "Pending Orders" y su CSS `.pending*`; su panel de confirmación es solo "Close position?". `vite.config.ts`: `changeOrigin: true` en el proxy de desarrollo para que `DEV_API_TARGET` pueda ser la API de producción tras Cloudflare (respondía 530 a la cabecera Host local).
- `npm run build` y `npm run lint` limpios.
- App local: Vite 5174 con proxy a `https://api-v2.amfxtrading.com` (la cookie y el origen `.amfxtrading.com` se aceptan), sesión iniciada; el usuario comprobó Positions el 23-10-2026: Accounts y las posiciones abiertas de todos los brokers con P&L en vivo, insignias de color, sin sección de pendientes; un comando enviado desde la página devolvió su toast de `command_result`. Confirmado por el usuario con capturas.
- Est vs Real: 1,5 vs 1 SP.

## Tarea 4 — Pestaña Orders (frontend)

- `PendingOrders.tsx`: tabla (Broker, Symbol con ColorBadge, Type, Lots, Price, Distance, SL, TP, Placed, Edit / Cancel por fila), tarjetas bajo 768 px, filtrado por broker / símbolo / tipo de orden / lado / color, opciones comunicadas al panel de filtros, grupo comunicado por `onGroupChange` solo cuando todas las órdenes listadas comparten símbolo y tipo (la regla de Positions), estados vacíos "No pending orders" / "No orders match the selected filters", doble clic → gráfico. `OrderCard.tsx` (+ pequeño `.module.css`) reutiliza `PositionCard.module.css` y `useSwipeActions`: Distance en el hueco del P&L a 28 px, el tipo "· Limit / · Stop" en la línea de etiquetas, detalle Type / Lots / SL / TP / Broker / Placed. `OrderFiltersPanel.tsx` con `utils/orderFilters.ts` (`OrderFilterValues`, valores por defecto, `hasActiveOrderFilters`), guardado como `journal.orderFilters`. `JournalPage`: pestaña Orders entre Positions e History, enlace `?tab=orders` que siembra los filtros de órdenes, botón y panel de Filters según la pestaña, Edit de grupo (toast provisional hasta la tarea 5) / Cancel, Cancel por fila. Confirmación de cancelación como la maqueta: `CancelOrdersPanel.tsx` sobre `ConfirmPanel.module.css` con `OrderList.tsx` (cabecera "Sell Limit EURUSD" + broker, o el broker en cada fila cuando el grupo abarca varios brokers; una fila por orden con precio, lotes, distancia), "Cancel all / Cancel order" y "Keep orders / Keep order". `fmtDistance` en `utils/position.ts`.
- `npm run build` y `npm run lint` limpios (tres errores de react-refresh resueltos sacando los helpers de los ficheros de componentes).
- App local contra producción: el usuario comprobó el 23-10-2026 la pestaña Orders con las órdenes pendientes en vivo de todos los brokers, la columna de distancia, los filtros, el Cancel de grupo sobre cinco Sell Limit EURUSD de cinco brokers (panel ajustado dos veces en su revisión: disposición de la maqueta, y después el broker por fila cuando difieren). Validado por el usuario.
- Est vs Real: 2 vs 1,75 SP.
