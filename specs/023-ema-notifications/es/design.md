# 023 — Notificaciones de cruce de EMAs en Settings · Diseño

## Enfoque

Un tipo de regla nuevo y permanente junto a las alertas de un solo disparo del gráfico, con su propia
tabla, rutas, caché en memoria y evaluador, construido sobre las piezas que ya usan las alertas EMA
(detección de cierre de vela en el flujo de ticks, `indicators/ema`, `services/push`, el envío WebSocket
por usuario). Las alertas del gráfico no se tocan. Settings se reconstruye como página con pestañas
(Mirror, Display, Notifications) con la barra del Journal, ancho completo en escritorio, tamaños de New
Trade en móvil, y dos paneles laterales (formulario de notificación, dispositivos).

Alternativas consideradas: ampliar `EmaCrossAlert` con repetición / fin / listas de pares — descartada,
la semántica de un disparo (desactivar al dispararse, `triggeredAt`) y el panel del gráfico tendrían que
cargar con cada campo nuevo; un modelo aparte mantiene ambos simples.

## Datos (db)

Migración `20261024000000_ema_notifications`:

```
ema_notifications
  id            serial PK
  userId        int → users (índice)
  broker        text
  symbols       text[]      -- vacío = todos los pares del broker
  timeframe     text        -- M5 | M15 | H1 | H4 | D1
  emaFast       int
  emaSlow       int
  event         text        -- cross | approach | both
  thresholdPips float       -- distancia de aproximación (ignorada con event = cross)
  direction     text        -- buy | sell | both
  repeatMinutes int null    -- null = una vez por evento
  endsAt        timestamptz null
  enabled       bool default true
  note          text null
  createdAt     timestamptz default now()
  índice (userId), índice (broker, enabled)

ema_notification_events          -- qué se disparó, para "last fired" y el reloj de repetición
  id             serial PK
  notificationId int → ema_notifications (cascada, índice)
  symbol         text
  kind           text        -- cross | approach
  direction      text        -- buy | sell
  candleTime     timestamptz -- cierre de la vela evaluada
  firedAt        timestamptz default now()
  índice (notificationId, symbol, firedAt desc)

push_subscriptions + userAgent text null, lastPushAt timestamptz null
```

Modelos Prisma `EmaNotification`, `EmaNotificationEvent`; `PushSubscription` gana las dos columnas.
`prisma migrate diff` contra producción debe listar exactamente estas sentencias.

## Backend

### `alerts/ema-notification-store.ts`

Caché de reglas activas cuyo `endsAt` es nulo o futuro, indexada broker → timeframe → reglas,
refrescada por las rutas tras cualquier cambio y cada minuto por un temporizador (para que una regla
termine a su hora sin petición). `getRules(broker, timeframe)`; `hasAny()`.

### `alerts/ema-notification-evaluator.ts`

Se engancha a la misma detección de cierre de vela que usan las alertas EMA:
`evaluateEmaNotifications(broker, batch)` se llama junto a `evaluateEmaAlerts` en `index.ts` y mantiene
su propio mapa `broker:symbol:tf → última hora de vela`. En un cierre de `tf` para `symbol`:

1. Reglas de (broker, tf) cuyo `symbols` está vacío o contiene `symbol`.
2. Velas: las últimas `max(fast, slow) + 2` velas cerradas del par (máximo 200), EMAs con
   `calculateEma`, gap actual / anterior en pips (`getPipSize`).
3. **Cruce** = signo(gapAhora) ≠ signo(gapAntes) → dirección `buy` si gapAhora > 0, si no `sell`.
   **Aproximación** = |gapAhora| < |gapAntes| y |gapAhora| ≤ thresholdPips y sin cruce en esta vela →
   dirección `buy` si gapAhora < 0 (la rápida sube hacia la lenta), si no `sell`.
4. Filtro de dirección; filtro de evento (`cross`, `approach`, `both`).
5. Repetición: la última fila de `ema_notification_events` de (regla, par). Un **cruce** solo dispara
   si su `candleTime` difiere de la vela de cruce (una vez por vela de cruce, sea cual sea
   `repeatMinutes`). Una **aproximación**: `repeatMinutes` nulo → dispara solo si el último evento no es
   una aproximación de la misma dirección aún "abierta" (el gap salió del umbral o hubo un cruce desde
   entonces; se sigue en memoria por regla+par como `approachOpenSince`); `repeatMinutes` N → dispara
   cuando `firedAt` tiene al menos N minutos.
6. Disparo: inserta la fila de evento, `sendToUser(push)` con título `EURUSD H1 · bullish cross` /
   `· approach (2.1 p)` y cuerpo con broker, EMAs, nota; WS `ema_notification` al usuario (nuevo
   emisor en `ws.ts`, mismo patrón que `broadcastEmaAlert`).

El `ema-alert-evaluator` del gráfico no se toca; ambos consumen el lote.

### Rutas

- `routes/ema-notifications.ts` montado en `/ema-notifications` (17 routers): `GET /` (reglas con su
  último evento por par → `lastFired`, y `state`: `active` | `paused` | `ended`), `POST /`, `PUT /:id`,
  `DELETE /:id`, con el estilo de validación de `ema-alerts.ts` (symbols array de cadenas no vacías,
  timeframe enumerado, event / direction enumerados, thresholdPips > 0 cuando event ≠ cross,
  repeatMinutes nulo o entero ≥ 1, endsAt nulo o fecha ISO, note cadena | nulo). Toda escritura llama a
  `refreshEmaNotifications()`.
- `routes/push.ts`: `POST /subscribe` guarda `userAgent` de la cabecera; `GET /` lista las
  suscripciones del usuario (`id`, `label` derivado del user agent: navegador · SO, `createdAt`,
  `lastPushAt`, hash del `endpoint` para que el cliente marque el suyo); `DELETE /:id`.
  `services/push.ts` actualiza `lastPushAt` en cada envío correcto.
- `GET /symbols?broker=` ya existe para la lista de chips (se comprueba en la tarea 4).

### Documentación

`docs/architecture.md` (17 routers, modelos, sección de alertas) y `.claude/CLAUDE.md` lo reflejan.

## Frontend

### Página Settings

`features/settings/SettingsPage.tsx` pasa a ser el armazón: barra de pestañas al estilo Journal
(patrones de `JournalPage.module.css` copiados a `SettingsPage.module.css`, reglas móviles incluidas),
pestañas **Mirror** / **Display** / **Notifications**, lado derecho según pestaña: Mirror y Display
muestran "Unsaved changes" + **Save** (un guardado para ambas, como el `PUT /settings` actual);
Notifications muestra **Devices · n** y **+ New notification**. En móvil el lado derecho pasa a la fila
de botones a ancho completo bajo las pestañas. Ancho de contenido: todo el de la página (desaparece el
tope de 600 px).

- `MirrorTab.tsx`: tabla en escritorio (Broker, toggle Mirror, Sizing, Lots / %, Account, Balance de
  `/balances`), filas apiladas en móvil; `inputMode="decimal"` en el input de lotes / % (CA 8).
- `DisplayTab.tsx`: las filas de hoy, mismo aspecto.
- `NotificationsTab.tsx`: tabla en escritorio (toggle On, Symbols + broker, TF, EMAs, Event, Direction,
  Repeat, Ends, insignia State, Last fired, Edit / Delete), tarjetas en móvil (resumen al estilo
  `PositionCard`: toggle, pares, etiqueta "TF · EMAs · evento", insignia de estado; detalle desplegado;
  Edit / Delete). Colores de estado: activa verde, pausada gris, terminada dorado.
- `NotificationPanel.tsx`: el formulario de la maqueta con los tamaños de `BulkEditPanel.module.css`:
  selects de broker y timeframe, chips de pares en rejilla de 5 columnas desde `/symbols?broker=` con
  "All symbols of the broker", EMA rápida / lenta, evento y dirección como botones segmentados, umbral
  (oculto con event = cross), select de repetición + minutos, fin como texto `dd/mm/yyyy hh:mm`
  (parseado como en el libro), nota. Create / Save.
- `DevicesPanel.tsx`: caja "This device · off" con **Enable this device** (`usePush().subscribe`) cuando
  el endpoint actual no está en la lista; la lista con etiqueta, desde, último push, "this device", Remove.
- `lib/useEmaNotifications.ts` (listar, crear, actualizar, borrar, alternar) y `lib/usePushDevices.ts`
  (listar, quitar, endpoint actual vía `pushManager.getSubscription()` del service worker).
- Toast: los consumidores de `useWs` ya muestran `ema_alert`; el mismo sitio muestra `ema_notification`
  ("EURUSD H1 · bullish cross · darwinex").
- `AlertsPanel` del gráfico: su control de push se sustituye por una línea "Manage devices in
  Settings"; todo lo demás sin tocar.

### Ficheros

```
backend/prisma/migrations/20261024000000_ema_notifications/migration.sql   nuevo
backend/prisma/schema.prisma                                              edit
backend/src/alerts/ema-notification-store.ts, ema-notification-evaluator.ts  nuevos
backend/src/routes/ema-notifications.ts                                   nuevo
backend/src/routes/push.ts, services/push.ts, ws/ws.ts, index.ts, app.ts  edit
backend/docs/architecture.md, .claude/CLAUDE.md                           edit
frontend/src/features/settings/SettingsPage.tsx + .module.css             reescritura
frontend/src/features/settings/MirrorTab.tsx, DisplayTab.tsx, NotificationsTab.tsx,
  NotificationPanel.tsx, DevicesPanel.tsx (+ .module.css donde haga falta) nuevos
frontend/src/lib/useEmaNotifications.ts, usePushDevices.ts               nuevos
frontend/src/features/chart/AlertsPanel.tsx                               edit (control de push → pista)
frontend/src/lib/book.ts                                                  edit (exportar parseBookInput / toBookInput para reutilizar) o un util compartido
```

## Maqueta

Artefacto Design aprobado por el usuario el 23-10-2026: https://claude.ai/artifact/9wXuSNmvu7y1fg4dHrNb2t.
Mesas: Settings · Notifications escritorio (barra con Devices · n y + New notification, tabla), Settings
· Mirror escritorio (tabla a todo el ancho, Unsaved changes + Save en la barra), Settings · Notifications
móvil (Devices y + New notification en la fila de botones, tarjetas), Settings · Mirror móvil (filas con
tamaños de New Trade, Save en la fila de botones), panel de nueva notificación (tamaños móviles, chips de
pares en filas de cinco), panel de dispositivos (caja Enable this device, dispositivos suscritos con
Remove).

## Riesgos

- Una regla sobre "todos los pares" de un broker con muchos pares evalúa una consulta por par en cada
  cierre de vela; M5 sobre 30 pares son 30 consultas pequeñas cada 5 minutos — asumible, pero las reglas
  D1 / H4 son el uso previsto para grupos.
- Los cierres de vela se detectan desde los ticks: un timeframe sin tick tras el cierre se evalúa en el
  siguiente tick, como las alertas EMA hoy.
- La entrega push es de mejor esfuerzo (iOS necesita la PWA instalada); el toast en la app siempre salta.
