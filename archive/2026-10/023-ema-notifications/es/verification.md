# 023 — Notificaciones de cruce de EMAs en Settings · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |
| 2 | `npm test` (7 sobre las reglas puras) + `npm run build` + lint | ✅ | 1,5 | 1 |
| 3 | `npm run build` + sondeos al backend local contra la base de datos de producción | ✅ | 1 | 1 |
| 4 | `npm run build` + `npm run lint` + app local contra producción (usuario) | ✅ | 1,5 | 1 |
| 5 | `npm run build` + `npm run lint` + app local contra el backend local (usuario) | ✅ | 2 | 1,5 |
| 6 | `npm run build` + `npm run lint` + app local contra el backend local (usuario) | ✅ | 1 | 0,75 |
| 7 | manual (despliegues comprobados por el operador + validación del usuario en producción) | ✅ | 1 | 0,75 |
| 8 | manual | ✅ | 0,25 | 0,25 |
| **Total** | | | **8,75** | **6,5** |

Calibración: todas las capas salieron por debajo de su estimación; las piezas ya existentes (evaluador de alertas EMA, servicio push, barra de pestañas del Journal, estilos del panel de edición, helpers de fecha del libro) dieron casi toda la estructura, y la maqueta fijó la interfaz antes de escribir código.

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (regla: broker, `symbols` text[], timeframe, EMAs, evento, thresholdPips por defecto 2, dirección, repeatMinutes anulable, endsAt anulable, enabled, nota) con índices por `userId` y `(broker, enabled)`; `ema_notification_events` (notificationId en cascada, par, tipo, dirección, candleTime, firedAt) con el índice `(notificationId, symbol, firedAt desc)`. Modelos Prisma `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, columnas de `PushSubscription`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` (por el túnel 5433) imprime exactamente las sentencias de la migración: las dos columnas, dos tablas, tres índices, dos claves foráneas.
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Caché de reglas y evaluador (backend)

- `alerts/ema-notification-rules.ts`: `detectSituation(gapAhora, gapAntes, umbral)` pura (cruce = el gap cambia de signo; aproximación = convergiendo, dentro del umbral, sin cruce) y `decideFire(regla, gapAhora, gapAntes, horaVela, últimoEvento, aproxAbierta, ahora)` (filtros de evento / dirección; un cruce dispara una vez por vela de cruce sea cual sea la repetición; una aproximación "una vez" dispara al abrirse y calla mientras sigue abierta, volviendo a disparar tras salir el gap del umbral o un cruce; una aproximación "cada N minutos" dispara cuando el último evento tiene N minutos). `alerts/ema-notification-store.ts`: caché de reglas activas no terminadas indexada broker → timeframe, `getActiveRules(broker, tf, par)` respetando la lista de pares (vacía = todos), refresco desde las rutas y temporizador de un minuto. `alerts/ema-notification-evaluator.ts`: misma detección de cierre de vela que las alertas EMA sobre el lote de ticks, una consulta de velas por par y cierre compartida por sus reglas, EMAs con `calculateEma`, último evento de `ema_notification_events`, `approachOpen` en memoria por regla y par, disparo = fila de evento + Web Push (título "EURUSD H1 · bullish cross" / "· bullish approach (2.1 p)") + WS `ema_notification` al dueño. Conectado en `index.ts` (refresco + temporizador al arrancar, evaluación junto a las alertas EMA, emisor) y `ws.ts` (`broadcastEmaNotification`).
- `npx vitest run src/alerts`: 7 tests pasan (cruces arriba / abajo, aproximación solo convergiendo dentro del umbral, cruce una vez por vela con repetición 5, filtros de dirección y evento, aproximación de una vez abierta / cerrada / reabierta, repetición cada 30 min, aproximación cerrada por el cruce). `npm run build` y `npx eslint src/alerts src/index.ts src/ws/ws.ts` limpios.
- Est vs Real: 1,5 vs 1 SP.

## Tarea 3 — Rutas, dispositivos y documentación (backend)

- `routes/ema-notifications.ts` montado en `/ema-notifications` (17 routers): `GET /` (reglas del usuario con `state` active / paused / ended y `lastFired`), `POST /`, `PUT /:id`, `DELETE /:id`; parseo con los helpers de `middleware/parse` (array de pares en mayúsculas y sin duplicados, vacío = todos; enumerados de timeframe / evento / dirección; EMAs positivas y distintas; thresholdPips > 0 salvo event = cross; repeatMinutes nulo o ≥ 1; endsAt ISO o nulo; nota recortada a 500 o nula). Toda escritura refresca la caché de reglas. `routes/push.ts`: `POST /subscribe` guarda el user agent, `GET /` lista los dispositivos (etiqueta "Chrome · Windows" / "Safari · iPhone" derivada de él, hash del endpoint, desde, último push), `DELETE /:id`; `services/push.ts` fija `lastPushAt` tras cada push entregado. Documentación: `architecture.md` (árbol, tabla de rutas, WS `ema_notification`, tablas) y `.claude/CLAUDE.md` (17 routers, modelos).
- Migración aplicada a producción por el túnel (`prisma migrate deploy`: `20261024000000_ema_notifications` aplicada; `migrate diff` → vacío) para que el pipeline de la tarea 7 no encuentre nada pendiente.
- Backend local (3001, bridges apagados, base de datos de producción) con sesión forjada: lista → `[]`; POST sin pares / EMAs iguales / timeframe H2 / aproximación con umbral 0 → 400 con el campo nombrado; POST correcto → 201 (pares `["eurusd","EURUSD","gbpusd"]` guardados como `["EURUSD","GBPUSD"]`, estado active, lastFired nulo); PUT pausa + fin pasado → estado ended; PUT una vez por evento + todos los pares → `repeatMinutes` nulo, `symbols` `[]`; PUT / DELETE sobre 999999 → 404; DELETE → 204, repetido → 404. `GET /push` lista los dos dispositivos existentes como "Unknown device" (suscritos antes de guardar el user agent; se reetiquetan en la siguiente suscripción); `DELETE /push/999999` → 404. La primera pasada destapó que `integer()` rechaza el parámetro de ruta como texto: cambiado a `intParam`. Regla de prueba eliminada después.
- Est vs Real: 1 vs 1 SP.

## Tarea 4 — Armazón de Settings, pestañas Mirror y Display (frontend)

- `SettingsPage.tsx` reescrito como armazón: barra de pestañas al estilo Journal (Mirror / Display / Notifications), un Save para Mirror + Display con marcador "Unsaved changes" y toast de éxito, ajustes y saldos cargados juntos; `SettingsPage.module.css` reescrito (barra de pestañas y botones del Journal, tabla, toggle, inputs, filas de display, reglas móviles: pestañas a ancho completo, fila de botones bajo las pestañas, tarjetas apiladas por broker, inputs de 44 px a 16 px). `MirrorTab.tsx`: tabla en escritorio (Broker, toggle Mirror, Sizing, Lots / %, Account, Balance de `/balances`), tarjetas en móvil; el input de lotes / % es un campo de texto con `inputMode="decimal"` parseado al cambiar (CA 8). `DisplayTab.tsx`: las cuatro filas de hoy. La pestaña Notifications es un hueco hasta la tarea 5; desaparece el tope de 600 px.
- `npm run build` y `npx eslint src/features/settings` limpios.
- App local (Vite 5174 contra la API de producción), comprobada por el usuario el 23-10-2026: pestañas, tabla del mirror editada y guardada, la recarga conserva los valores, opciones de display, disposición móvil y teclado decimal. Validado por el usuario.
- Est vs Real: 1,5 vs 1 SP.

## Tarea 5 — Pestaña Notifications, panel y hook (frontend)

- `lib/useEmaNotifications.ts` (tipos, `useRemoteList` sobre `/ema-notifications`, crear / actualizar / alternar / borrar, helpers de etiquetas). `NotificationsTab.tsx` + `.module.css`: tabla en escritorio (toggle On, Symbols + broker, TF, EMAs, Event, Direction, Repeat, Ends, insignia State verde / gris / dorada, Last fired, Edit / Delete), tarjetas en móvil (toggle, pares, estado; al tocar se despliegan timeframe · EMAs, evento, dirección, repetición, fin, broker, último disparo, nota, Edit / Delete); filas pausadas y terminadas atenuadas. `NotificationPanel.tsx` + `.module.css`: el formulario de la maqueta con los tamaños del panel de edición — selects de broker y timeframe, chips de pares en rejilla de 5 columnas desde `/symbols?broker=` más "All symbols of the broker", EMA rápida / lenta, botones segmentados de evento y dirección (umbral oculto con cross), select de repetición + minutos, fin tecleado como `dd/mm/yyyy hh:mm` en hora local, nota; comprobaciones en cliente con toasts; `nonce` reinicia el formulario en cada apertura. `SettingsPage`: + New notification en la barra, editar / alternar / borrar (ConfirmPanel) conectados. `AppLayout`: WS `ema_notification` → toast "EURUSD H1 · bullish cross · darwinex" (verde alcista, rojo bajista, 8 s).
- `npm run build` y `npx eslint` limpios.
- App local (Vite 5174 contra el backend local 3001 sobre la base de datos de producción, sesión en incógnito), comprobada por el usuario el 23-10-2026: regla creada (EURUSD H1, aproximación ≤ 3 p, cada 15 min), edición con el panel relleno, pausar / reanudar, estado terminada con fin pasado, borrado con confirmación, tarjetas móviles. Arreglado en la revisión: la columna Ends pintaba la fecha con el formateador UTC del libro, dos horas distinta de la hora local tecleada → formateador local. El toast de disparo se comprueba en producción (tarea 7).
- Est vs Real: 2 vs 1,5 SP.

## Tarea 6 — Panel de dispositivos (frontend)

- `lib/usePushDevices.ts`: lista desde `GET /push`, quitar (`DELETE /push/:id`), el endpoint de suscripción de este navegador hasheado con `crypto.subtle` como hace el servidor, `thisDeviceSubscribed`, recarga tras suscribir. `DevicesPanel.tsx` + `.module.css`: caja "This device · notifications off" con **Enable this device** (`usePush().subscribe`; los casos no soportado / bloqueado explican qué hacer), los dispositivos suscritos con etiqueta, desde, último push, "this device", y Remove con confirmación en el segundo clic. `SettingsPage`: **Devices · n** en la barra con punto naranja mientras este navegador no está suscrito. `AlertsPanel` del gráfico: el botón de activar se sustituye por una pista a Settings → Notifications → Devices.
- `npm run build` y `npx eslint` limpios (un `set-state-in-effect` reescrito como promesa iniciada en el efecto).
- App local contra el backend local, comprobada por el usuario el 23-10-2026: botón Devices y punto, panel con las dos suscripciones existentes ("Unknown device": suscritas antes de guardar el user agent), Remove con confirmación, pista del gráfico. El flujo Enable necesita las claves VAPID de producción y se comprueba en la tarea 7.
- Est vs Real: 1 vs 0,75 SP.

## Tarea 7 — Despliegues y validación en producción (infra)

- Dos push el 23-10-2026: `d33519f..2758a8b` (spec, db, backend) → backend 198 con `migrate deploy` sin nada pendiente (la migración se había aplicado por el túnel en la tarea 3), `/ema-notifications` y `/push` respondiendo 401 sin sesión; después `2758a8b..a4cb836` (frontend) → bundle con el nuevo Settings servido a las 14:21 UTC. La primera mirada del usuario en el iPhone encontró Mirror y Display desbordando el ancho (selects dimensionados por su opción más larga, tarjetas con margen negativo): `f017600` lo corrigió, desplegado a las 14:27 UTC.
- Validación del usuario en producción (escritorio e iPhone), 23-10-2026: pestañas de Settings, % del mirror con decimales en el móvil, Devices (Enable en ambos dispositivos, filas con nombre, entradas antiguas quitadas), una regla en EURUSD M5 disparando push y toast con "Last fired" relleno, hora de fin → Ended, panel Alerts del gráfico sin cambios con la pista. Validado por el usuario.
- Est vs Real: 1 vs 0,75 SP.

## Tarea 8 — Cierre (specs)

- Builds de backend y frontend limpios de nuevo; Est vs Real registrado; `Estado: cerrada`; carpeta movida a `archive/2026-10/`. Queda para que el usuario lo afine con el uso: la regla de aproximación "una vez" (dispara al abrirse la aproximación, y de nuevo solo tras salir el gap del umbral o un cruce).
- Est vs Real: 0,25 vs 0,25 SP.
