# 018 · FE-03 — Capa de red compartida · Diseño

## Enfoque

Tres módulos pequeños en `src/lib/` y un retoque de rutas, y después una migración archivo a archivo que no cambia ningún comportamiento salvo los que piden los requisitos (401 → login, payload de cierre uniforme, vuelta al deep link). Sin dependencias nuevas, sin librería de data fetching, sin provider: FE-05 añadirá la caché encima de `apiFetch`.

## `lib/api.ts`

Conserva `apiUrl`, `errorFrom`, `errorMessage`, `isAbortError` y añade:

```ts
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void { onUnauthorized = handler; }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = init.body !== undefined
    ? { 'Content-Type': 'application/json', ...init.headers }
    : { ...init.headers };
  const res = await fetch(apiUrl(path), { credentials: 'include', ...init, headers });
  if (res.status === 401) { onUnauthorized?.(); throw new ApiError(401, 'Session expired'); }
  if (!res.ok) throw new ApiError(res.status, await errorFrom(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiSend<T = void>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method, body: body === undefined ? undefined : JSON.stringify(body) });
}
```

- `signal` viaja dentro de `init`, así que los controllers de la spec 017 siguen funcionando; un aborto rechaza antes de cualquier comprobación de estado con el `AbortError` del navegador (AC 4).
- `errorFrom` ya lee `error ?? message ?? Error <status>` (AC 2). El mensaje del 401 es fijo porque el cuerpo es irrelevante una vez que se redirige al usuario.
- Cuerpo vacío → `undefined` cubre los tres endpoints `204` (`DELETE /alerts/:id`, `DELETE /ema-alerts/:id`, `POST /push/unsubscribe`) y `POST /auth/logout` (AC 3).
- `apiSend` existe solo para quitar la repetición `method + JSON.stringify` en ~20 puntos de mutación; no es una segunda abstracción.

## Auth: hook del 401 y deep link

**`features/auth/AuthContext.tsx`.** Al montar, `setUnauthorizedHandler(() => setUser(null))`, limpiado al desmontar. `/auth/me` pasa a `apiFetch<User>('/auth/me').then(setUser).catch(() => setUser(null))`: un 401 dispara el handler (usuario ya null, sin efecto visible) y el `catch` conserva la semántica de `loading` vía `finally`. `login` pasa a `apiSend<{ user: User }>('/auth/login', 'POST', { email, password })`: un 401 o 400 rechaza con el `message` del backend, que `LoginPage` ya muestra; que el handler se dispare con una contraseña incorrecta es inocuo porque el usuario es null. `logout` pasa a `apiSend('/auth/logout', 'POST')` dentro del `try/finally` existente.

**`app/ProtectedRoute.tsx`.** `const location = useLocation();` y `<Navigate to="/login" replace state={{ from: location.pathname + location.search }} />`. Cuando un 401 limpia el usuario a mitad de sesión, corre la misma redirección y recuerda la página en la que estaba.

**`features/auth/LoginPage.tsx`.** Tras `login`, `navigate(returnTo, { replace: true })` donde `returnTo` es `location.state?.from` si es una cadena que empieza por `/` (y no es `/login`), si no `/` (AC 9). La guarda evita un open redirect vía un history state manipulado.

## `lib/commands.ts`

```ts
export type CommandAction = 'buy' | 'sell' | 'buylimit' | 'selllimit' | 'buystop' | 'sellstop' | 'close' | 'modify';
export type LotsMode = 'fixed' | 'risk_pct';
export interface Command {
  id: string; action: CommandAction; broker: string; symbol: string;
  lots?: number; lotsMode?: LotsMode; sl?: number; tp?: number; price?: number; ticket?: number;
}
type PositionRef = Pick<Position, 'broker' | 'symbol' | 'ticket' | 'lots'>;

export function newCommandId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
export function closeCommand(p: PositionRef): Command {
  return { id: newCommandId(), action: 'close', broker: p.broker ?? '', symbol: p.symbol, ticket: p.ticket, lots: p.lots };
}
export function modifyCommand(p: PositionRef, sl: number, tp: number): Command {
  return { ...closeCommand(p), action: 'modify', sl, tp };
}
export async function sendCommand(cmd: Command): Promise<string> {
  await apiSend('/commands', 'POST', cmd);
  return cmd.id;
}
```

- `closeCommand` es el único payload de cierre (AC 5): `id, action, broker, symbol, ticket, lots`, sin `sl`/`tp`. El backend los trata como opcionales en `close` y el `StringToDouble(ExtractField(json, "sl"))` del EA devuelve 0 cuando faltan, así que `command.json` se comporta igual.
- `Position.broker` es opcional en el tipo; un broker vacío lo rechaza el backend con un 400 que el llamador muestra en toast, que es el resultado honesto (hoy la misma situación envía `undefined` y recibe el mismo 400).
- `sendCommand` devuelve el id para que `NewTradePanel` siga registrando los ids pendientes antes del POST (genera el id con `newCommandId()`, construye el `Command` y llama a `sendCommand`).

**Puntos de llamada.** `ChartPage.handleModifyPosition` → `sendCommand(modifyCommand(pos, sl, tp)).catch(err => addToast(errorMessage(err, 'Network error sending modify'), 'error'))`. `ClosePositionPanel`, `OpenPositions.confirmAndClose` → `await sendCommand(closeCommand(position))`. `BulkEditPanel` → `modifyCommand(p, sl ? parseFloat(sl) : p.sl, tp ? parseFloat(tp) : p.tp)` por posición; `JournalPage.handleBulkClose` → `closeCommand(p)` por posición; ambos pasan de `Promise.all(fetch…)` + `filter(!ok)` a `Promise.allSettled(cmds.map(sendCommand))` + `filter(status === 'rejected')`, conservando el texto del toast `N of M commands rejected: <primer motivo>`. `NewTradePanel` pierde su `sendCommand` y `generateId` locales; el estado `action` se tipa `CommandAction`. Se borran las cinco funciones `generateId` y la plantilla inline de `ChartPage` (AC 6).

## `lib/useRemoteList.ts`

```ts
export function useRemoteList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const load = useCallback((signal?: AbortSignal) =>
    apiFetch<T[]>(path, { signal }).catch((err: unknown) => { if (isAbortError(err)) throw err; return [] as T[]; }), [path]);
  const refresh = useCallback(() => load().then(setItems), [load]);
  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal).then(setItems).catch(() => {});
    return () => ac.abort();
  }, [load]);
  const mutate = useCallback(async (action: () => Promise<unknown>) => {
    try { await action(); } finally { await refresh(); }
  }, [refresh]);
  return { items, refresh, mutate };
}
```

`useAlerts` pasa a `const { items: alerts, refresh, mutate } = useRemoteList<PriceAlert>('/alerts')` más `create = (a) => mutate(() => apiSend('/alerts', 'POST', a))`, `toggle = (a) => mutate(() => apiSend(`/alerts/${a.id}`, 'PUT', { enabled: !a.enabled }))`, `remove = (id) => mutate(() => apiSend(`/alerts/${id}`, 'DELETE'))`; devuelve `{ alerts, refresh, create, toggle, remove }` como hoy. `useEmaAlerts` es lo mismo sobre `/ema-alerts` (AC 8). Una carga fallida sigue leyéndose como `[]`; un 401 sigue pasando por el handler antes del `catch`. La carga de montaje gana un aborto al desmontar, que los hooks antiguos no tenían.

## Migración del resto de llamadas

Mecánica, archivo a archivo, conservando el tratamiento actual de cada punto:

| Archivo | Llamadas | Notas |
|---|---|---|
| `features/chart/ChartPage.tsx` | 9 | `/chart-indicators` GET/PUT, `/settings`, `/balances`, `/symbols`, `/positions/live`, `/candles` ×2, `/drawings` GET/PUT. Los puntos que hacían `r.json()` sin comprobar `ok` ahora rechazan en no-OK y caen en su `.catch(() => {})` existente en lugar de guardar un cuerpo de error como datos |
| `features/journal/*` | 10 | `Accounts` (`/balances`, `/balances/daily-pnl`), `ClosedPositions`, `ColorBadge` (PATCH), `NewTradePanel` (`/settings`, `/balances`, `/symbols` ×2, `/setup-levels`), snapshot de `OpenPositions` |
| `features/settings/SettingsPage.tsx` | 3 | GET ×2, PUT |
| `features/scanner/ScannerPage.tsx`, `features/stats/StatsPage.tsx` | 3 | GET |
| `lib/*` | 8 | `useBalances`, `useBuildInfo` (`/version` es público; enviar la cookie es inocuo), `useDisplaySettings`, `usePush` ×3, `useScanner` (conserva su controller; `res.ok ? … : EMPTY` pasa a `catch` → `EMPTY`) |

Reglas aplicadas en todas partes: conservar el `signal`, conservar el resultado del `catch`, quitar `if (!res.ok) throw new Error(await errorFrom(res))` (apiFetch lanza), sustituir mensajes fijos tipo `throw new Error('Failed to load trades')` por el mensaje del `ApiError`. Estado final: `grep -c "fetch(" src/**` encuentra solo el de dentro de `apiFetch` (AC 10).

## Flujo de datos

Solo frontend. El cuerpo de `POST /commands` enviado para `close` pierde `sl: 0, tp: 0` en dos de los tres caminos; backend y EA aceptan ambas formas. Ningún otro cambio en el cable; el contrato EA ↔ backend queda intacto.

## Riesgos

- **Cambio de comportamiento en GETs no-OK.** Los puntos que parseaban el cuerpo sin comprobar `ok` podían guardar un objeto de error como datos (p. ej. `setEmas(undefined)`). Tras la migración rechazan y conservan el estado anterior. Es la dirección buscada (spec 016) pero es un cambio: lo cubre la pasada en producción de todas las páginas.
- **401 durante una acción masiva.** Varios comandos en vuelo que reciben 401 llaman al handler varias veces; `setUser(null)` es idempotente y `ProtectedRoute` navega una vez.
- **Texto de error del login.** `errorFrom` lee `error ?? message`; la ruta de login devuelve `message`. Se verifica con un intento de contraseña incorrecta que muestre el texto del backend.
- **History state.** `from` se valida como ruta interna; un valor ausente o ajeno cae a `/`.
- **Tamaño del alcance.** ~50 puntos en 20 archivos; se mitiga con el orden archivo a archivo, un commit por grupo y el `grep` final como gate.

## Verificación

- `npx eslint .` · `npm run build` tras cada tarea; `git grep -n "fetch(" frontend/src` → 1 resultado; `git grep -n generateId frontend/src` → 0.
- Stack local: borrar la cookie `token` en DevTools estando en `/chart?broker=…&symbol=…`, provocar cualquier llamada → `/login`; iniciar sesión → de vuelta a la misma URL del gráfico con su query (AC 1, AC 9). Abrir `/journal?tab=open` sin sesión → login → journal con la pestaña.
- DevTools Network: cerrar una posición desde el panel del gráfico, desde una fila del journal y con el cierre masivo → tres `POST /commands` con el mismo conjunto de claves (AC 5); New Trade manual y espejo siguen produciendo un POST por broker con `pendingIds` resolviéndose en `command_result`.
- Panel de alertas: crear / activar / borrar una alerta de precio y una de EMA; un create rechazado (p. ej. precio inválido) muestra el texto del backend y la lista se refresca (AC 8).
- Pasada en producción: `/chart`, `/journal` (open, closed, accounts, colores), guardar en `/settings`, `/scanner`, `/stats`, suscribir/desuscribir push, números de build del footer (AC 11).
