# 010 · BE-08 — Vitalidad por broker · Diseño

## Enfoque

Un único store en memoria, `store/liveness.ts`, guarda el estado por broker (`pipe`, `lastTickAt`, `lastSyncAt`) y deriva el cuerpo de `/health` con una función pura. `PipeReader` y `FileWatcher` informan a ese store; `index.ts` registra cada broker configurado al arrancar (así un broker aparece aunque no haya mandado nada todavía, y como `disabled` cuando la feature flag está apagada). El reintento del pipe vive dentro de `PipeReader` como un bucle de `listen` con backoff exponencial. La ruta HTTP solo formatea el store — sin I/O, así que sigue siendo tan rápida como hoy para los scripts de deploy y arranque.

Sin dependencias nuevas.

## Cambios por capa

### backend

**1. `src/store/liveness.ts` (nuevo)**

```ts
export type PipeState = 'listening' | 'connected' | 'error' | 'disabled';
interface BrokerLiveness { pipe: PipeState; lastTickAt: Date | null; lastSyncAt: Date | null; watcher: boolean }

register(broker, { pipe: boolean, watcher: boolean })   // desde index.ts, estado = disabled si el pipe está apagado
setPipeState(broker, state)
touchTick(broker, at = new Date())
touchSync(broker, at = new Date())
snapshot(): Map<string, BrokerLiveness>                 // copia, para tests

export const STALE_TICK_MS = 5 * 60_000;
export function healthReport(now: Date, startedAt: Date, state: Map<...>): HealthReport
```

`healthReport` es pura: por cada broker `name, pipe, lastTickAt (ISO|null), lastSyncAt (ISO|null), tickAgeS, syncAgeS`; `status = 'degraded'` cuando algún broker con `pipe !== 'disabled'` no está `connected` o tiene `tickAgeS === null || tickAgeS > 300`; si no, `'ok'`. `uptimeS = (now − startedAt) / 1000` redondeado. Que el watcher esté desactivado solo da `lastSyncAt: null`; nunca afecta a `status` (un sync obsoleto no es criterio de vitalidad en esta spec — el EA escribe esos ficheros a su propio ritmo).

**2. `src/bridge/pipe-reader.ts`**

- `start()` pasa a ser `listen(attempt = 0)`: crea el servidor (una vez) y llama a `server.listen(pipePath)`. En el evento `'error'` de la fase de *listen*: `setPipeState(broker, 'error')`, log `[PIPE-READER:<broker>] listen failed (attempt n, retry in Ns): <mensaje>`, `setTimeout(() => listen(attempt + 1), min(1000 · 2^attempt, 30 000))`. En `'listening'`: `setPipeState('listening')`, contador de intentos a cero.
- Handler de conexión: `setPipeState('connected')` al conectar, `setPipeState('listening')` al cerrarse el socket. Cada mensaje parseado (ticks, posiciones, cuenta) llama a `touchTick(broker)`.
- `stop()` limpia el timer de reintento y cierra el servidor.
- `net.Server` emite `'error'` tanto por fallos de listen como por errores posteriores en ejecución; tras `'listening'` el camino de reintento sigue siendo correcto (cerrar + listen de nuevo), así que un solo handler cubre ambos.

**3. `src/bridge/file-watcher.ts`**

- `poll()` → en `finally`, `touchSync(broker)` (el poll corrió; los fallos por paso ya los registra `runStep`).
- Error de directorio en `readCandles()`: `console.error('[FILE-WATCHER: <broker>] cannot list <ruta> | <mensaje>')`, limitado con un campo `lastListErrorAt`: se emite cuando `now − lastListErrorAt ≥ 60 000`.

**4. `src/index.ts`**

- En `startBroker`: `register(brokerName, { pipe: features.pipe, watcher: features.watcher })`.
- `syncColors(brokerName, tickets).catch(err => console.error('[COLORS:' + brokerName + ']', mensaje(err)))`.
- Se evita pasar `startedAt` a la ruta vía `app.locals`: `app.ts` mantiene su propio `const startedAt = new Date()` al cargar el módulo (el módulo carga una vez al arrancar el proceso; la diferencia con `main()` son milisegundos).

**5. `src/app.ts`**

```ts
app.get('/health', (_req, res) => res.json(healthReport(new Date(), startedAt, snapshot())));
```

Siempre `200`. Ejemplo de respuesta:

```json
{ "status": "degraded", "uptimeS": 5121,
  "brokers": [
    { "name": "darwinex", "pipe": "connected", "lastTickAt": "2026-10-02T08:14:03.120Z", "lastSyncAt": "2026-10-02T08:13:50.002Z", "tickAgeS": 1, "syncAgeS": 14 },
    { "name": "solidary isa", "pipe": "listening", "lastTickAt": "2026-10-02T06:00:11.000Z", "lastSyncAt": "…", "tickAgeS": 8032, "syncAgeS": 14 } ] }
```

**6. Tests (vitest)**

- `store/liveness.test.ts`: casos puros de `healthReport` — todos conectados y frescos → `ok`; uno `listening` → `degraded`; uno conectado pero con tick de hace más de 5 min → `degraded`; pipe desactivado → ignorado, `ok`; broker conectado que nunca ha mandado tick → `degraded` con `tickAgeS: null`; formato ISO/edades; `uptimeS`.
- `bridge/pipe-reader.test.ts` (integración sobre un named pipe real, solo Windows — `describe.skipIf(process.platform !== 'win32')`): ocupar `\\.\pipe\mt4tick_<aleatorio>` con un `net.Server` plano, arrancar `PipeReader`, con timers falsos comprobar `pipe === 'error'` y el calendario de reintentos 1 s → 2 s; liberar el pipe → siguiente reintento → `listening`; conectar un cliente y escribir una línea de tick → `connected` + `lastTickAt` fijado; el cliente termina → `listening`. CI corre en `ubuntu-latest`, así que la suite se salta allí; corre en la máquina Windows del desarrollador. Los sockets de dominio Unix podrían sustituirlo en Linux pero la semántica de rutas difiere; no compensa para esta spec.

## Flujo de datos

EA → pipe → `PipeReader` → `touchTick`/`setPipeState` → store `liveness` ← `touchSync` ← `FileWatcher`. `GET /health` → `healthReport(snapshot)`. Sin BD, sin WS.

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/src/store/liveness.ts` | nuevo: estado por broker + `healthReport` pura |
| `backend/src/store/liveness.test.ts` | nuevo |
| `backend/src/bridge/pipe-reader.ts` | reintento de listen con backoff, informe de estado + ticks, `stop()` limpia el timer |
| `backend/src/bridge/pipe-reader.test.ts` | nuevo (integración solo Windows) |
| `backend/src/bridge/file-watcher.ts` | `touchSync` por poll, error de directorio limitado y con mensaje |
| `backend/src/index.ts` | `register` por broker, error de `syncColors` registrado |
| `backend/src/app.ts` | cuerpo de `/health` desde `healthReport` |
| `backend/docs/architecture.md` | sección `GET /health` actualizada (el doc ya describe la ruta) |

## Riesgos

- **Scripts de deploy/arranque**: solo comprueban HTTP 200 (`Wait-Health`, `Test-BackendHealth`); el cambio de cuerpo les es invisible. Se verifica en la tarea de producción observando la propia espera de health del deploy.
- **Fin de semana**: forex no manda ticks de viernes noche a domingo noche, así que `status` dirá `degraded` con `tickAgeS` grande en todos los brokers. Aceptado en los requisitos; los valores de los campos hacen obvia la causa. Un futuro watchdog debe mirar `pipe` y no `status` para decidir un reinicio.
- **Reintento sobre un pipe retenido por un proceso zombi**: el bucle registra cada intento (como mucho uno cada 30 s); nunca mata al otro proceso — `deploy.ps1` ya gestiona los huérfanos en el deploy.
- `'error'` de `net.Server` tras `'listening'` (raro en named pipes) ahora provoca un re-listen; antes se registraba y quedaba muerto.
