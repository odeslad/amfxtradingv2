# 015 · BE-10 — Documentación del backend y código muerto · Diseño

> Status: **approved**

## Enfoque

Cuatro piezas independientes, primero el código (para que la documentación describa el código ya podado) y la documentación al final:

1. **`indicators/ema-cross.ts`** podado a lo que leen `services/scanner.ts` y `routes/setup-levels.ts`.
2. **Exports muertos**, el comentario obsoleto de `index.ts` y un **`.env.example`** completo.
3. **`backend/docs/architecture.md`** reescrito contra el código.
4. Sección de backend de **`.claude/CLAUDE.md`** reescrita; secciones de engine y estrategias movidas a **`epics/trading-engine/concept.md`**.

Nada cambia en el cable: no se toca ninguna ruta, mensaje WS, tabla de BD ni archivo del EA. El deploy es un deploy de backend normal cuyo único efecto observable es un scanner más rápido.

## 1. `indicators/ema-cross.ts` (`[backend]`)

### Qué leen los consumidores

| Consumidor | Campos de `EmaCrossSetup` |
|---|---|
| `services/scanner.ts` | `direction`, `activationIndex`, `activationTime`, `activationPrice`, `mfePrice`, `maePrice` |
| `routes/setup-levels.ts` | `direction`, `activationTime`, `levels` |
| `ema-cross.test.ts` | los anteriores más `closeIndex`, `candleCount` |

### Forma resultante

```ts
export interface EmaCrossContext {
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell' | 'both';
}

export interface EmaCrossSetup {
  direction: 'buy' | 'sell';
  activationIndex: number;
  activationTime: Date;
  activationPrice: number;
  closeIndex: number | null;
  closeTime: Date | null;
  closePrice: number | null;
  candleCount: number;
  levels: { ECC: number; EMA: number; EVL: number | null; MHL: number | null };
  mfePrice: number | null;
  mfeTime: Date | null;
  maePrice: number | null;
  maeTime: Date | null;
}
```

Se eliminan: `WeakConfig`, `StrongConfig`, `PivotPoint`, `pivotLen` / `weakConfig` / `strongConfig` del contexto, `weakCandles` / `strongCandles` / `pivots` del setup, y las funciones `classifyCandles`, `detectPivots`, `isSwingHigh`, `isSwingLow` (~130 líneas). `closeTime` / `closePrice` se quedan: no cuestan nada (ya se calculan para `closeIndex`) y describen el fin del setup, del que depende `candleCount`. El parámetro `pipSize` de `detectEmaCrossSetups` solo lo consumía `classifyCandles`; también se va, y ambos consumidores dejan de pasar el tercer argumento (`pip` lo siguen usando para su propia salida).

Todo lo que queda (detección de cruces, `interpolateCross`, `findSetupClose`, `findPreviousOppositeCross`, `findEvl`, `findMhl`, `calculateMaeMfe`) no se toca, así que cada campo conservado mantiene su valor (AC 5).

### Verificación de AC 5–6

Las respuestas del scanner y de setup-levels dependen de velas en vivo, así que una comparación antes/después tiene que usar los mismos datos:

1. Por el túnel de BD, volcar las velas cerradas de dos símbolos × dos timeframes (p. ej. `EURUSD` H1 y `XAUUSD` H4, broker más grande) al scratchpad como fixtures JSON — unos miles de filas, nunca commiteadas.
2. Un script `tsx` de scratch (scratchpad) carga un fixture, llama a `detectEmaCrossSetups(candles, { emaFast: 5, emaSlow: 20, direction: 'both' })` y escribe los campos conservados de cada setup a un archivo JSON. Se ejecuta una vez sobre el `master` actual (antes) y otra tras la poda; el `diff` debe salir vacío.
3. Backend local en el puerto 3001 contra el túnel (pipe/watcher apagados): `curl` a `/scanner?broker=…&tf=H4&emaFast=5&emaSlow=20` y `/setup-levels?…&tf=H4…` con cookie de sesión, antes y después, dentro de la misma vela H4 (el watcher está apagado en local y el conjunto de velas H4 solo cambia cada cuatro horas, así que la entrada es estable); los dos cuerpos deben ser idénticos byte a byte (AC 6). La ejecución «antes» se hace al inicio de la tarea 1, antes de editar el archivo.

`ema-cross.test.ts` pierde el argumento `pipSize` en sus llamadas y nada más: sus aserciones nunca tocaron los campos eliminados (AC 7).

## 2. Exports muertos, `index.ts:1`, `.env.example` (`[backend]`)

Una búsqueda export a export (cada `export function|const|interface|type` buscado como palabra completa en todo `src/`, tests incluidos) no encuentra lector para:

| Export | Acción |
|---|---|
| `store/positionColors.ts` `getColorsByBroker` | borrar la función |
| `services/push.ts` `isPushEnabled` | borrar la función |
| `bridge/command-io.ts` `POLL_MS` · `bridge/pipe-reader.ts` `RETRY_BASE_MS`, `RETRY_MAX_MS` · `services/chunk.ts` `CHUNK_SIZE` · `store/liveness.ts` `STALE_TICK_MS` · `routes/commands.ts` `ACTIONS` | quitar la palabra `export` (constantes privadas del módulo) |
| `interface` / `type` exportados sin importador (`WaitOutcome`, `AccountHandler`, `ScannerRow`, `SizingResult`, `HealthReport`, …) | se quedan — nombran la forma pública del resultado de su módulo y no cuestan nada |

`index.ts:1` (`// deploy smoke test: verify deploy.ps1 recovers from the Prisma DLL lock`) es un resto del ensayo de deploy de la spec 005; se borra.

`.env.example` pasa a ser la lista completa que leen `config.ts` y `db/client.ts`:

```ini
# PostgreSQL connection string (required)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/amfxtradingv2"
# JWT signing secret for the session cookie (required; any long random string)
JWT_SECRET="change-me"
# Path to the brokers config: [{ "name": "...", "bridgePath": "C:\\...\\MQL4\\Files\\bridge" }] (required)
BROKERS_FILE="C:\\amfxtradingv2\\backend\\brokers.json"
# HTTP port (optional, default 3000)
PORT=3000
# Session cookie domain (optional, default .amfxtrading.com). "none" issues a host-only cookie for localhost.
COOKIE_DOMAIN=.amfxtrading.com
# Web Push VAPID keys (optional; push notifications are disabled when unset). Generate with `npx web-push generate-vapid-keys`.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:info@amfxtrading.com
# Feature flags (optional; only the literal value false disables a feature)
FEATURE_PIPE=true
FEATURE_WATCHER=true
FEATURE_ALERTS=true
FEATURE_WS_BROADCAST=true
# Log every Prisma query (optional; set to "query" to enable)
PRISMA_LOG=
```

El nombre de la BD en el ejemplo cambia de `amfxtrading` a `amfxtradingv2` (el real). `web-push` ya es dependencia (el comando de generación de claves usa su CLI).

## 3. `backend/docs/architecture.md` (`[backend]`)

Reescrito sección a sección; las secciones `/health` y `POST /commands` de las specs 010/012 se conservan palabra por palabra.

- **Overview / flujo de datos**: un `PipeReader` + un `FileWatcher` por broker desde `brokers.json`; pipe `\\.\pipe\mt4tick_<broker>` (el backend es el servidor) con tres tipos de línea — array = batch de ticks (100 ms), `{type:"positions"}` (1 s), `{type:"account"}` (1 s); el watcher lee cada 30 s `account.json`, `history.json`, `candles_<SYM>_<TF>.json` (el EA los escribe cada 60 s; `positions.json` lo escribe el EA y no lo lee nadie); stores en memoria (`ticks`, `positions`, `accounts`, `liveness`, `positionColors`); alertas evaluadas con los ticks (precio) y al cierre de vela (convergencia de EMAs) → BD + WS + Web Push; `POST /commands` → `command.json` → `result.json` / `pending.json`.
- **Estructura del proyecto**: el árbol real de `src/` (alerts, app, bridge, config, db, index, indicators, middleware, routes, services, store, version, ws).
- **Variables de entorno**: la tabla del `.env.example` de arriba.
- **API HTTP**: lista de rutas de `app.ts` con una línea cada una (`/auth`, `/commands`, `/trades`, `/positions`, `/balances`, `/settings`, `/symbols`, `/candles`, `/chart-indicators`, `/drawings`, `/alerts`, `/ema-alerts`, `/scanner`, `/setup-levels`, `/push`, `/stats`, `/health`), auth = JWT en cookie HttpOnly, `requireAuth` en todo salvo `/auth` y `/health`; las secciones `/health` y `POST /commands` existentes.
- **WebSocket**: `/ws`, cookie JWT y `Origin` comprobados en el upgrade, ping/pong, política de backpressure; tipos de mensaje `ticks`, `positions`, `account`, `command_result`, `alert`, `ema_alert` con `broker` en la raíz.
- **Base de datos**: tablas existentes con su patrón de escritura — `candles` (createMany skipDuplicates, solo velas cerradas), `trades` (createMany skipDuplicates por ticket), `balance_operations`, `balances` (un upsert por broker y día UTC), `settings_mirror`, `settings_display`, `position_colors`, `users`, `price_alerts`, `ema_cross_alerts`, `push_subscriptions`, `drawings`, `chart_indicators`.
- **Ejecución / deploy**: scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:*`), resumen de `deploy.ps1` (migrate → build en `dist.next` → swap → reinicio pm2 → `/health`, rollback si falla).

## 4. `.claude/CLAUDE.md` y `epics/trading-engine/concept.md` (`[docs]`)

- Las líneas 320–575 del archivo actual (`## Trading Engine (Fase 2 — en diseño)`, `## Diseño del sistema de estrategias`, `## Pendiente backend (Fase 2)`) se mueven literalmente a `epics/trading-engine/concept.md`, precedidas de:

  ```markdown
  # Trading Engine — concept (moved from CLAUDE.md)

  > Moved on 2026-10-08 by spec 015 (BE-10). Design notes written during Fase 2 for an engine that was
  > started and then removed in spec 001; nothing below is implemented. Split into specs with /amfx-spec-new
  > when the engine is taken up again. Open items at the time of the move: trailing `riskCut`, levels `EMCC`
  > and `SHL`, entry distance filters, realtime mode.
  ```

- `## Arquitectura del backend (Fase 2 — implementada)` (líneas 273–318) se reescribe en español, mismo encabezado, con: tabla de comunicación (pipe con sus tres tipos de mensaje, archivos del bridge que lee el watcher, bridge de comandos con `pending.json` / resultados tardíos / retirada), tipos de mensaje del WS `/ws` con `broker` en la raíz, velas activas construidas desde los ticks en el frontend, multi-broker, lista de modelos de BD, resumen de deploy. Sigue siendo un resumen (~50 líneas) y remite a `backend/docs/architecture.md` para el detalle; los dos documentos no deben contradecirse.
- Un puntero de una línea al epic va bajo `## Estructura del proyecto`, donde se describe `epics/` (ya existe) — ninguna otra sección cambia.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/indicators/ema-cross.ts`, `ema-cross.test.ts` | poda; los tests dejan de pasar `pipSize` |
| `backend/src/services/scanner.ts`, `backend/src/routes/setup-levels.ts` | quitar el tercer argumento de `detectEmaCrossSetups` |
| `backend/src/store/positionColors.ts`, `backend/src/services/push.ts` | borrar funciones sin uso |
| `backend/src/bridge/command-io.ts`, `bridge/pipe-reader.ts`, `services/chunk.ts`, `store/liveness.ts`, `routes/commands.ts` | quitar `export` de constantes |
| `backend/src/index.ts` | quitar la línea 1 |
| `backend/.env.example` | lista completa de variables |
| `backend/docs/architecture.md` | reescritura |
| `.claude/CLAUDE.md` | sección de backend reescrita; secciones de engine eliminadas |
| `epics/trading-engine/concept.md` | nuevo (contenido movido) |
| `reports/2026-09-30-backend.md` | columna `Spec` de BE-10 → `015` / `015 ✅` |

## Riesgos

- **Un campo conservado cambia de valor tras la poda** — descartado por el diff del fixture y la comprobación byte a byte de las rutas; las funciones conservadas no se editan.
- **La documentación vuelve a desviarse** — mitigado manteniendo `CLAUDE.md` como resumen que remite a `architecture.md`, y haciendo que `architecture.md` solo nombre rutas que existen (comprobado con un `test -e` por script sobre cada ruta que menciona, tarea 3).
- **Quitar el `export` de una constante que un test futuro quiera** — se vuelve a exportar entonces; sin efecto en runtime.

## Alternativas consideradas

- **Borrar las secciones del engine** — el usuario prefiere conservarlas como epic.
- **Mantener `pipSize` en `detectEmaCrossSetups` para uso futuro** — los parámetros sin uso son exactamente lo que esta spec elimina; es una línea para volver a añadirlo.
- **`ts-prune` / `knip` para exports muertos** — una dependencia de desarrollo nueva para algo puntual; la búsqueda con grep basta y no deja herramientas atrás.
