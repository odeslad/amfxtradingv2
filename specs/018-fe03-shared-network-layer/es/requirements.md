# 018 · FE-03 — Capa de red compartida

> Status: **approved**
> Origin: [auditoría frontend 2026-10-08](../../../reports/2026-10-08-frontend.md), mejora 3 (diagnósticos B, E)

## Contexto

Cada llamada a la API del frontend es un `fetch` escrito a mano: unas 50 llamadas en 20 archivos, cada una repitiendo `apiUrl(...)`, `credentials: 'include'`, la cabecera JSON, la comprobación de `res.ok` y la extracción del error. La spec 016 hizo honestos esos puntos de llamada (ahora comprueban `res.ok` y muestran toast en fallo) y la spec 017 dio un `AbortSignal` a los efectos de carga, pero el boilerplate sigue copiado en todas partes, así que cada llamada nueva parte de cero y las pequeñas diferencias siguen colándose.

Tres consecuencias concretas hoy. (1) Un `401` es invisible: cuando caduca la cookie JWT, todas las llamadas fallan con un error genérico y el usuario se queda en una página que ya no funciona hasta que recarga; `AuthContext` solo conoce la sesión al montar (`/auth/me`). (2) Los siete puntos que hacen `POST /commands` (`ChartPage` modify, `BulkEditPanel`, `ClosePositionPanel`, `JournalPage` cierre masivo, `NewTradePanel` manual + espejo, `OpenPositions` cierre) construyen el payload y generan el `id` del comando a mano: `generateId` está definido cinco veces más una plantilla inline en `ChartPage`, y los tres caminos de cierre envían tres payloads distintos (`ClosePositionPanel` manda `ticket, lots`; `OpenPositions` y `JournalPage` añaden `sl: 0, tp: 0`). (3) `useAlerts` y `useEmaAlerts` son el mismo hook dos veces (cargar lista, `refresh`, tres mutaciones que lanzan en `!res.ok` y refrescan en `finally`) cambiando solo el endpoint y los tipos. Aparte, `ProtectedRoute` redirige a `/login` sin recordar dónde estaba el usuario, así que un deep link (por ejemplo desde una notificación push) aterriza siempre en `/` tras el login.

Esta spec añade un único `apiFetch<T>()` que se encarga de credenciales, JSON, extracción de errores y el hook del `401`; un módulo `lib/commands.ts` que se encarga de los ids y payloads de los comandos; un `useRemoteList` genérico sobre el que se construyen los dos hooks de alertas; y la vuelta al deep link tras el login. Todos los `fetch` existentes migran a `apiFetch` para que la gestión del `401` sea universal. Los `AbortSignal` añadidos por la spec 017 se conservan.

## Capas afectadas

- frontend

Sin cambios en backend, db, EA ni infra. El payload de `POST /commands` que envía el frontend se vuelve uniforme pero se mantiene dentro de lo que el backend ya acepta (`sl`/`tp` son opcionales en `close`). Sin dependencias nuevas.

## Historias de usuario

- Como trader, quiero que me lleve a la página de login en cuanto caduque mi sesión, para no seguir pulsando en una página cuyas llamadas fallan en silencio.
- Como trader, quiero aterrizar en la página que estaba abriendo (un deep link del gráfico, un filtro del journal) tras iniciar sesión, para que las notificaciones y los enlaces compartidos funcionen en un solo paso.
- Como trader, quiero que todas las formas de cerrar una posición (gráfico, fila del journal, cierre masivo) envíen el mismo comando, para que el comportamiento no dependa de qué botón usé.
- Como desarrollador, quiero un único sitio que sepa llamar a la API y un único sitio que sepa construir un comando, para que una llamada o un comando nuevos no puedan olvidar las credenciales, la cabecera JSON, la comprobación de error ni el formato del id.

## Criterios de aceptación

- AC 1. CUANDO cualquier llamada a la API hecha con `apiFetch` devuelve `401` ENTONCES el contexto de auth limpia el usuario, `ProtectedRoute` redirige a `/login` y la llamada fallida rechaza con un `ApiError` de estado 401.
- AC 2. CUANDO una llamada devuelve un estado no OK distinto de 401 ENTONCES `apiFetch` rechaza con un `ApiError` con el estado y el texto `error`/`message` del backend (o `Error <status>` cuando el cuerpo no trae ninguno), y el camino de toast/error existente del llamador muestra ese texto.
- AC 3. CUANDO una llamada devuelve `204` o un cuerpo vacío ENTONCES `apiFetch` resuelve a `undefined` sin intentar parsear JSON.
- AC 4. CUANDO `apiFetch` se llama con un `signal` ENTONCES la señal se pasa a `fetch` y un aborto rechaza con el `AbortError` del navegador, sin cambios, de modo que la cancelación de la spec 017 sigue funcionando e `isAbortError` sigue reconociéndolo.
- AC 5. CUANDO se cierra una posición desde el panel del gráfico, la fila del journal o la acción masiva del journal ENTONCES los tres caminos envían un `POST /commands` con la misma forma de payload (`id`, `action: 'close'`, `broker`, `symbol`, `ticket`, `lots`) construida por `lib/commands.ts`.
- AC 6. CUANDO cualquiera de los siete puntos de envío de comandos manda un comando ENTONCES el `id` viene de `newCommandId()` en `lib/commands.ts`, y no queda ninguna función `generateId` ni plantilla de id inline en `src/`.
- AC 7. CUANDO se llama a `sendCommand` ENTONCES devuelve el `id` del comando y rechaza con el texto de error del backend en fallo, de modo que los llamadores que rastrean ids pendientes (`NewTradePanel`) siguen funcionando.
- AC 8. CUANDO `useAlerts` y `useEmaAlerts` se reescriben sobre `useRemoteList` ENTONCES su forma pública (`alerts`/`emaAlerts`, `refresh`, `create`, `toggle`, `remove` y los tipos exportados) no cambia y los paneles compilan sin más ediciones que imports; una carga fallida sigue leyéndose como lista vacía y cada mutación sigue refrescando en `finally`.
- AC 9. CUANDO un usuario no autenticado abre una URL protegida ENTONCES tras un login correcto se le redirige a esa URL (ruta + query); una visita directa a `/login` sigue aterrizando en `/` tras el login.
- AC 10. CUANDO la migración está completa ENTONCES no queda ninguna llamada directa a `fetch(` en `src/` salvo dentro del propio `apiFetch`, y `/auth/me` y `/auth/login` de `AuthContext` pasan también por `apiFetch` (un 401 ahí resuelve a "sin usuario" / "credenciales incorrectas" sin bucle de redirección, porque el usuario ya es null).
- AC 11. CUANDO la implementación está completa ENTONCES `npx eslint .` y `npm run build` pasan en `frontend/`, y la app en producción se comporta como antes en `/chart`, `/journal`, `/settings`, `/scanner`, `/stats` y el panel de alertas.

## Fuera de alcance

- Provider/cachés compartidos de balances, settings y símbolos, y conexión/desconexión del WebSocket ligada al auth (FE-05).
- Trabajo de render por tick (FE-04) y el `SidePanel` compartido (FE-07).
- Reintentos, deduplicación de peticiones o una librería de data fetching.
- Cambiar el contrato de `POST /commands` del backend.
- Refresco de token: una sesión caducada va a la página de login; no se renueva en silencio.
