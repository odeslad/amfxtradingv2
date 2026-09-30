# 004 — Frontera de errores y validación de peticiones · Diseño

> Estado: **cerrada**

## Enfoque

Dos capas independientes, ambas dentro de `backend/src`, sin dependencias nuevas:

1. **Frontera de errores** — tres piezas pequeñas que hacen que una petición fallida termine en `500` en lugar de matar el proceso: un envoltorio `asyncRoute` que reenvía la promesa rechazada del handler a `next(err)`, un middleware de error final de Express, y `process.on('unhandledRejection')` como última red.
2. **Validación de peticiones** — un módulo `middleware/parse.ts` con parsers tipados (`intParam`, `dateParam`, `epochParam`, `oneOf`, `singleQuery`) que lanzan ante entrada inválida, más una clase de error `BadRequest` que las rutas lanzan; el middleware de error la convierte en `400 { error }`. Las rutas que ya validan (`alerts`, `ema-alerts`, `setup-levels`, `scanner`, `drawings`, `push`, `stats`) conservan su forma y solo ganan el envoltorio; las seis rutas sin validar reciben comprobaciones explícitas.

Alternativas consideradas:

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| `express-async-errors` (parchea el Router) | cero código por ruta | dependencia nueva; implícito; toca internos de Express | descartada |
| Express 5 | manejo nativo de errores async | salto mayor sin tests; spec aparte | más adelante ("ahora no" de la auditoría) |
| Esquemas zod/valibot | declarativo, tipos reutilizables | dependencia nueva para ~25 comprobaciones; `.claude/CLAUDE.md` prohíbe añadir deps sin necesidad | descartada |
| **Envoltorio + parsers a mano** | sin deps, explícito, eliminable cuando llegue Express 5 | ~80 líneas de helpers que mantener | **elegida** |

## Frontera de errores

### `middleware/asyncRoute.ts`

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler<Req extends Request = Request> =
  (req: Req, res: Response, next: NextFunction) => Promise<void>;

export const asyncRoute = <Req extends Request = Request>(fn: AsyncHandler<Req>): RequestHandler =>
  (req, res, next) => { fn(req as Req, res, next).catch(next); };
```

El genérico mantiene tipados los handlers con `AuthRequest` (`asyncRoute<AuthRequest>(async (req, res) => { req.userId ... })`).

### `middleware/errors.ts`

```ts
export class BadRequest extends Error {
  readonly status = 400;
  constructor(message: string) { super(message); }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BadRequest) { res.status(400).json({ error: err.message, message: err.message }); return; }
  console.error(`[HTTP] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal error' });
}
```

Montado el último en `app.ts` (tras todos los routers). El `new Error('Not allowed by CORS')` del callback de CORS también aterriza aquí y pasa a ser un `500` con línea de log en vez del HTML por defecto de Express — aceptable; mapearlo a `403` es una línea si se quiere después.

Clave de respuesta: las rutas existentes responden `{ error }` (`commands`, `candles`, `settings`, `stats`, `symbols`) o `{ message }` (`auth`, `alerts`, `ema-alerts`, `drawings`, `push`, `scanner`, `setup-levels`), y el frontend lee una u otra según la llamada (`body.error` en `NewTradePanel.tsx:187`, `message` en `AuthContext.tsx:38`). Para ser compatible con todos los consumidores sin renombrar nada, las respuestas de `BadRequest` llevan **ambas claves** con el mismo texto. Los `400` escritos a mano existentes se dejan intactos (AC 13).

### `index.ts`

```ts
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED] rejection', reason));
process.on('uncaughtException', (err) => { console.error('[UNCAUGHT] exception', err); process.exit(1); });
```

`unhandledRejection` registra y continúa — una promesa rechazada que nadie esperaba (p. ej. `syncColors` antes de su `.catch`) ya está contenida por diseño de quien la llamó. `uncaughtException` sigue saliendo: un throw síncrono fuera de todo handler implica estado desconocido, y pm2 reinicia limpio. El prefijo de log hace ambos buscables.

## Validación

### `middleware/parse.ts`

```ts
import { BadRequest } from './errors';

type Query = Record<string, unknown>;

// Los valores de query pueden ser string | string[] | undefined (qs). Una clave repetida es 400 (AC 11).
export function singleQuery(q: Query, key: string): string | undefined {
  const v = q[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new BadRequest(`${key} must be a single value`);
  return v;
}

export function intParam(raw: string | undefined, key: string, opts: { min?: number; max?: number; default?: number }): number | undefined
// undefined → opts.default; no entero o fuera de [min, max] → BadRequest; max recorta solo con opts.clamp (lo usa limit).

export function epochParam(raw: string | undefined, key: string): Date | undefined
// entero positivo en segundos → Date; si no BadRequest.

export function dateParam(raw: string | undefined, key: string): Date | undefined
// new Date(raw) con comprobación NaN → BadRequest.

export function oneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T
export function optionalOneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T | undefined
export function finiteNumber(value: unknown, key: string, opts?: { positive?: boolean }): number
export function optionalFiniteNumber(...)
export function integer(value: unknown, key: string): number
export function optionalInteger(...)
export function optionalString(value: unknown, key: string): string | undefined
export function optionalBoolean(value: unknown, key: string): boolean | undefined
```

Todos lanzan `BadRequest` con el nombre del parámetro en el mensaje ("limit must be an integer between 0 and 1000"). Lanzar dentro de un handler con `asyncRoute` llega a `errorHandler` vía `next(err)`, así que las rutas quedan lineales (sin escaleras de `if (error) { res.status(400)...; return; }`).

`limit` conserva la semántica de recorte actual (`Math.min(x, max)`) en lugar de rechazar valores por encima del tope, para preservar AC 13 ante un frontend que pueda enviar límites grandes: `intParam(raw, 'limit', { min: 1, max: 5000, default: 500, clamp: true })`.

### Cambios por ruta

| Ruta | Hoy | Cambio |
|---|---|---|
| `GET /trades` | `parseInt` sin comprobar, `new Date` sin comprobar | `limit` entero [0..1000] recorte por defecto 200 · `offset` entero ≥ 0 por defecto 0 · `from`/`to` `dateParam` · `broker`/`symbol` `singleQuery` |
| `GET /candles` | `Math.min(parseInt)`, epoch sin comprobar | `limit` entero recorte 5000 por defecto 500 · `before`/`after` `epochParam` · `broker`/`symbol`/`tf` `singleQuery` (comprobación de requeridos sin cambios) |
| `GET /candles/emas` | `parseInt` sin comprobar | `emaFast`/`emaSlow` entero ≥ 1 · `from`/`to` `epochParam` · `singleQuery` en strings |
| `PATCH /positions/color` | solo `ticket == null` | `ticket` `integer` · `color` `optionalString` (por defecto `''`) · `broker` string no vacío |
| `PUT /settings` | solo `Array.isArray(mirror)` | cada item de mirror: `broker` string no vacío, `enabled` booleano, `lotsMode` `oneOf(['fixed','risk_pct'])`, `lots` finito > 0 · `display`: `pnlMode` `oneOf(['net','gross','pips','pct'])`, `trendlineStyle` `optionalOneOf(['solid','dashed','dotted'])`, `trendlineColor` `optionalString`, `trendlineWidth` `optionalInteger` ≥ 1. La validación corre **antes** de construir `ops`, así que un item malo no escribe nada (AC 7) |
| `PUT /chart-indicators` | ninguna | `Array.isArray(emas)` si no 400 |
| `PUT /alerts/:id` | ninguna sobre el body | `validatePartial(body)`: mismas reglas que `validate` para cada campo presente (`price` finito, `direction` oneOf, `enabled` booleano, `note` string\|null, `broker`/`symbol` no vacíos) |
| `PUT /ema-alerts/:id` | ninguna sobre el body | ídem: `emaFast`/`emaSlow` entero > 0 (y distintos, comprobado contra `existing` cuando solo se envía uno), `direction`, `thresholdPips` > 0, `timeframe` |
| `POST /commands` | presencia de 4 campos | `action` `oneOf(ACTIONS)` · `id` regex `^[A-Za-z0-9_-]{1,64}$` · `broker`/`symbol` no vacíos · `lotsMode` `optionalOneOf(['fixed','risk_pct'])` · `lots`: requerido finito > 0 salvo que `lotsMode === 'risk_pct'` (entonces es el % de riesgo — finito > 0) o `action ∈ {close, modify}` (entonces opcional) · `sl`/`tp`/`price` `optionalFiniteNumber` ≥ 0 · `ticket` `optionalInteger`, requerido cuando `action ∈ {close, modify}`. Todas las comprobaciones ocurren antes de `res.status(202)` y antes de `enqueue` (AC 10) |
| `GET /stats` | ya valida | solo `singleQuery` |
| `GET /symbols` | `String(broker)` | `singleQuery` |
| resto | ya validan | envolver con `asyncRoute`, sin cambio de lógica |

`ACTIONS` se exporta desde `routes/commands.ts` como `['buy','sell','buylimit','selllimit','buystop','sellstop','close','modify'] as const` — la misma lista que documenta `.claude/CLAUDE.md`.

### Validación parcial en `alerts` / `ema-alerts`

Extraer las reglas por campo del `validate(body)` existente en predicados por campo y añadir `validatePartial(body)` que aplica cada predicado solo cuando el campo es `!== undefined`. `POST` sigue llamando a `validate` (campos requeridos), `PUT` llama a `validatePartial`. En `ema-alerts`, la regla `emaFast !== emaSlow` en `PUT` compara el valor fusionado (`body.emaFast ?? existing.emaFast`).

## Flujo de datos

Sin cambios. No cambia el contrato EA ↔ backend: los campos y formas de `command.json` son idénticos para entrada válida; la entrada inválida ya no llega al archivo.

## Archivos a tocar

- nuevos `backend/src/middleware/asyncRoute.ts`, `errors.ts`, `parse.ts`
- `backend/src/app.ts` (montar `errorHandler` el último)
- `backend/src/index.ts` (handlers de proceso)
- `backend/src/routes/trades.ts`, `candles.ts`, `positions.ts`, `settings.ts`, `chart-indicators.ts`, `alerts.ts`, `ema-alerts.ts`, `commands.ts`, `stats.ts`, `symbols.ts`, `balances.ts`, `drawings.ts`, `push.ts`, `scanner.ts`, `setup-levels.ts`, `auth.ts` (solo envoltorio donde no cambia la lógica)

## Estrategia de verificación

Todavía no hay ejecutor de tests (mejora 11 de la auditoría). Esta spec verifica con:

- `npm run build` por tarea.
- Un script desechable `specs/004-error-boundary-request-validation/tooling/smoke.mjs` (Node ≥ 18, `fetch`, sin deps) que hace login con las variables de entorno `EMAIL`/`PASSWORD`, repite una lista fija de peticiones inválidas comprobando `400`, una lista de peticiones válidas comprobando `200` y comparando los cuerpos con un `baseline.json` capturado antes del cambio (AC 13), e imprime una tabla. Se ejecuta contra el backend local (puerto 3001) durante la implementación y contra producción en la tarea de cierre, seguido de `pm2 list`.
- La carpeta tooling es desechable (se conserva en la spec por reproducibilidad, nunca se despliega).

## Riesgos

- **Una petición válida que el frontend envía hoy y las nuevas comprobaciones rechazan.** Mitigado por la repetición del baseline de AC 13; la lista de humo se construye a partir de las llamadas reales del frontend (grep de `apiUrl(`). Se preserva la semántica de recorte de `limit`.
- **`errorHandler` pisando una respuesta ya iniciada.** Protegido con `res.headersSent`.
- **`unhandledRejection` ocultando bugs reales.** Registra con prefijo distintivo; la mejora 8 de la auditoría (health/vitalidad) sacará contadores. No salir es precisamente el objetivo de esta spec.
- **El rechazo CORS ahora devuelve `500` JSON** en lugar de la página HTML de Express. Para orígenes permitidos no cambia nada.
