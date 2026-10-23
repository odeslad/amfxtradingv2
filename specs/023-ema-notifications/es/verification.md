# 023 — Notificaciones de cruce de EMAs en Settings · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |
| 2 | `npm test` (7 sobre las reglas puras) + `npm run build` + lint | ✅ | 1,5 | 1 |

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (regla: broker, `symbols` text[], timeframe, EMAs, evento, thresholdPips por defecto 2, dirección, repeatMinutes anulable, endsAt anulable, enabled, nota) con índices por `userId` y `(broker, enabled)`; `ema_notification_events` (notificationId en cascada, par, tipo, dirección, candleTime, firedAt) con el índice `(notificationId, symbol, firedAt desc)`. Modelos Prisma `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, columnas de `PushSubscription`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` (por el túnel 5433) imprime exactamente las sentencias de la migración: las dos columnas, dos tablas, tres índices, dos claves foráneas.
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Caché de reglas y evaluador (backend)

- `alerts/ema-notification-rules.ts`: `detectSituation(gapAhora, gapAntes, umbral)` pura (cruce = el gap cambia de signo; aproximación = convergiendo, dentro del umbral, sin cruce) y `decideFire(regla, gapAhora, gapAntes, horaVela, últimoEvento, aproxAbierta, ahora)` (filtros de evento / dirección; un cruce dispara una vez por vela de cruce sea cual sea la repetición; una aproximación "una vez" dispara al abrirse y calla mientras sigue abierta, volviendo a disparar tras salir el gap del umbral o un cruce; una aproximación "cada N minutos" dispara cuando el último evento tiene N minutos). `alerts/ema-notification-store.ts`: caché de reglas activas no terminadas indexada broker → timeframe, `getActiveRules(broker, tf, par)` respetando la lista de pares (vacía = todos), refresco desde las rutas y temporizador de un minuto. `alerts/ema-notification-evaluator.ts`: misma detección de cierre de vela que las alertas EMA sobre el lote de ticks, una consulta de velas por par y cierre compartida por sus reglas, EMAs con `calculateEma`, último evento de `ema_notification_events`, `approachOpen` en memoria por regla y par, disparo = fila de evento + Web Push (título "EURUSD H1 · bullish cross" / "· bullish approach (2.1 p)") + WS `ema_notification` al dueño. Conectado en `index.ts` (refresco + temporizador al arrancar, evaluación junto a las alertas EMA, emisor) y `ws.ts` (`broadcastEmaNotification`).
- `npx vitest run src/alerts`: 7 tests pasan (cruces arriba / abajo, aproximación solo convergiendo dentro del umbral, cruce una vez por vela con repetición 5, filtros de dirección y evento, aproximación de una vez abierta / cerrada / reabierta, repetición cada 30 min, aproximación cerrada por el cruce). `npm run build` y `npx eslint src/alerts src/index.ts src/ws/ws.ts` limpios.
- Est vs Real: 1,5 vs 1 SP.
