# 009 · BE-05 — Endurecimiento del WebSocket · Diseño

## Enfoque

Reescribir `backend/src/ws/ws.ts` alrededor de `WebSocketServer({ noServer: true })` y un handler explícito `server.on('upgrade')`. El handler de upgrade es la única puerta: comprueba la ruta, el `Origin` y el JWT, responde un error HTTP plano sobre el socket crudo si algo falla, y solo entonces llama a `handleUpgrade`. Todo lo puro (comparación de origen, parseo de cookie, política de buffer) vive en un módulo pequeño sin imports de `ws`/`http` para poder testearlo unitariamente; `ws.ts` conserva el cableado. La superficie pública de `createWss` (`broadcastTicks`, `broadcastPositions`, …) no cambia, así que `index.ts` solo gana la llamada de apagado.

Sin dependencias nuevas: `ws` 8 ya trae `noServer`, `handleUpgrade`, `ping`/`pong` y `bufferedAmount`.

## Cambios por capa

### backend

**1. `src/ws/policy.ts` (nuevo, puro)**

```ts
export const ALLOWED_ORIGINS = [/\.amfxtrading\.com(:\d+)?$/];   // sale de app.ts, lo importan ambos
export const isAllowedOrigin = (origin: string | undefined): boolean
export const tokenFromCookie = (cookieHeader: string | undefined): string | null
export const HEARTBEAT_MS = 30_000;
export const SKIP_ABOVE_BYTES = 1 << 20;   // 1 MB
export const KILL_ABOVE_BYTES = 8 << 20;   // 8 MB
export type SendDecision = 'send' | 'skip' | 'terminate';
export const sendDecision = (bufferedAmount: number): SendDecision
```

- `isAllowedOrigin(undefined)` → `false` para el WS (un navegador siempre envía `Origin` en el handshake de WebSocket; un cliente no-navegador sin él tampoco tiene cookie). Difiere del middleware CORS, que sigue permitiendo peticiones sin `Origin` (curl, el health check del deploy).
- `app.ts` importa `ALLOWED_ORIGINS` desde `ws/policy.ts` en vez de su propia constante — una sola lista.

**2. `src/ws/ws.ts` (reescritura)**

```ts
interface Client extends WebSocket { userId: number; isAlive: boolean }

export function createWss(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (url(req).pathname !== '/ws') return;                    // otros upgrades no son de nadie: destroy
    if (!isAllowedOrigin(req.headers.origin)) return reject(socket, 403, 'Forbidden');
    const userId = verifyToken(tokenFromCookie(req.headers.cookie));
    if (userId === null) return reject(socket, 401, 'Unauthorized');
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, userId));
  });

  wss.on('connection', (ws: Client, _req, userId: number) => {
    ws.userId = userId; ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    …logs como hoy…
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Client>) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; ws.ping();
    }
  }, HEARTBEAT_MS);

  function send(ws: Client, message: string) {
    if (ws.readyState !== WebSocket.OPEN) return;
    switch (sendDecision(ws.bufferedAmount)) {
      case 'terminate': ws.terminate(); return;
      case 'skip': return;
      case 'send': ws.send(message);
    }
  }
  const broadcast = (type, payload) => para cada cliente → send
  const sendToUser = (userId, type, payload) => para los clientes con ws.userId === userId → send

  return {
    …mismos métodos de broadcast…,
    broadcastAlert: (userId, …)    => sendToUser(userId, 'alert', {...}),
    broadcastEmaAlert: (userId, …) => sendToUser(userId, 'ema_alert', {...}),
    close() { clearInterval(heartbeat); for (ws of wss.clients) ws.terminate(); wss.close(); },
  };
}
```

- `reject(socket, status, text)` escribe `HTTP/1.1 <status> <text>\r\nConnection: close\r\n\r\n` y `socket.destroy()`. Un upgrade a una ruta distinta de `/ws` se destruye sin estado (hoy `ws` con `path` hace lo mismo: 400).
- `verifyToken` reutiliza `jwt.verify(token, config.jwtSecret)` y lee `sub` como `requireAuth.ts`; devuelve `null` ante cualquier fallo.
- El callback de `handleUpgrade` emite `connection` con `userId` como tercer argumento; el handler de `connection` es el único sitio que escribe `ws.userId`, así que no existe socket sin él.
- Las cargas de `alert` / `ema_alert` conservan el campo `userId` (el frontend sigue comparándolo).
- Terminar por `!isAlive` usa `terminate()` (no `close()`): un par muerto nunca completaría el handshake de cierre.
- El salto por 1 MB se aplica por mensaje, así que un cliente lento pero vivo pierde ticks (bien: el siguiente lote trae precios frescos) pero conserva la conexión; solo un cliente que nunca drena llega a 8 MB.

**3. `src/index.ts`**

`SIGTERM`: `wss.close()` primero, después pipes/watchers, `server.close()`, y `db.$disconnect()` al final (la auditoría señaló que se desconectaba la BD antes de cerrar el HTTP; se corrige el orden ya que se toca el bloque). El comportamiento en Windows/pm2 no cambia (ese camino rara vez se ejecuta) pero el temporizador del latido no debe mantener vivo un apagado ordenado.

**4. Tests (`vitest`, de la spec 008)**

- `ws/policy.test.ts`: lista de orígenes (host de prod, `local.amfxtrading.com:5174`, `https://evil.com`, `undefined`), `tokenFromCookie` (ausente, primera, en medio, con otras cookies, valor URL-encoded intacto), umbrales de `sendDecision`.
- `ws/ws.test.ts` (integración, sockets reales en puerto efímero con `ws` como cliente): 403 con origen malo, 401 sin cookie, 101 con token firmado; entrega de alertas por usuario (dos clientes, dos usuarios); latido con timers falsos — un cliente al que se le quita el handler de `pong` se termina tras dos intervalos mientras el sano sigue. `config` necesita `JWT_SECRET`/`DATABASE_URL`/`BROKERS_FILE`: el test fija `process.env` antes de importar y apunta `BROKERS_FILE` a un JSON de fixture en la carpeta de tests (`[{ "name": "test", "bridgePath": "." }]`) — nunca al `brokers.json` real.

## Flujo de datos

Sin cambios: EA → pipe → `index.ts` → `wss.broadcast*` → clientes. Solo el conjunto de clientes se filtra ahora (origen + JWT en la puerta, `userId` para alertas) y se poda (latido, backpressure).

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/src/ws/policy.ts` | nuevo: lista de orígenes, parseo de cookie, constantes de latido/backpressure y `sendDecision` |
| `backend/src/ws/policy.test.ts` | nuevo |
| `backend/src/ws/ws.ts` | reescritura: `noServer` + puerta en `upgrade`, `userId` por socket, latido, backpressure, `sendToUser`, `close()` |
| `backend/src/ws/ws.test.ts` | nuevo: tests de integración |
| `backend/src/ws/fixtures/brokers.json` | nuevo: fixture de test para `config` |
| `backend/src/app.ts` | importa `ALLOWED_ORIGINS` desde `ws/policy` |
| `backend/src/index.ts` | orden de apagado con `wss.close()` |

## Riesgos

- **Origin en desarrollo local**: el proxy de Vite reenvía el `Origin` del navegador (`https://local.amfxtrading.com:5174`), que encaja con la regex; se verifica también en la tarea de validación sobre el stack local. Si un futuro host de desarrollo no cuelga de `amfxtrading.com`, la lista debe crecer — explícito por diseño.
- **Cloudflare / nginx**: ambos reenvían `Origin` y `Cookie` sin tocar en los upgrades de WebSocket (la cookie ya es como se autentica el WS hoy); las respuestas `403`/`401` previas al upgrade son HTTP plano y pasan.
- **Falsos positivos del latido**: una pestaña en segundo plano sigue respondiendo pings a nivel de protocolo (lo hace el navegador, no el JS), así que solo se terminan conexiones realmente muertas. Con 30 s de intervalo, un par muerto vive como mucho ~60 s.
- **Frontend tras un upgrade rechazado**: el navegador dispara `onclose`, el cliente reintenta cada 3 s — el mismo bucle que el cierre 1008 de hoy; fuera de alcance.
- `wss.emit('connection', …, userId)` depende de que el argumento extra llegue al listener; tipado con una interfaz local `Client` y cubierto por el test de integración.
