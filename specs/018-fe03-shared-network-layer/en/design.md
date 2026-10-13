# 018 · FE-03 — Shared network layer · Design

## Approach

Three small modules in `src/lib/` and a route tweak, then a file-by-file migration that changes no behaviour except the ones the requirements ask for (401 → login, uniform close payload, deep-link return). No new dependencies, no data-fetching library, no provider: FE-05 will add caching on top of `apiFetch`.

## `lib/api.ts`

Keeps `apiUrl`, `errorFrom`, `errorMessage`, `isAbortError` and adds:

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

- `signal` travels inside `init`, so spec 017's controllers keep working; an abort rejects before any status check with the browser's `AbortError` (AC 4).
- `errorFrom` already reads `error ?? message ?? Error <status>` (AC 2). The 401 message is fixed because the body is irrelevant once the user is being redirected.
- Empty body → `undefined` covers the three `204` endpoints (`DELETE /alerts/:id`, `DELETE /ema-alerts/:id`, `POST /push/unsubscribe`) and `POST /auth/logout` (AC 3).
- `apiSend` exists only to remove the `method + JSON.stringify` repetition at ~20 mutation sites; it is not a second abstraction.

## Auth: 401 hook and deep link

**`features/auth/AuthContext.tsx`.** On mount, `setUnauthorizedHandler(() => setUser(null))`, cleared on unmount. `/auth/me` becomes `apiFetch<User>('/auth/me').then(setUser).catch(() => setUser(null))` — a 401 fires the handler (user already null, no visible effect) and the `catch` keeps `loading` semantics via `finally`. `login` becomes `apiSend<{ user: User }>('/auth/login', 'POST', { email, password })`: a 401 or 400 rejects with the backend's `message`, which `LoginPage` already displays; the handler firing on a wrong password is a no-op because the user is null. `logout` becomes `apiSend('/auth/logout', 'POST')` inside the existing `try/finally`.

**`app/ProtectedRoute.tsx`.** `const location = useLocation();` and `<Navigate to="/login" replace state={{ from: location.pathname + location.search }} />`. When a 401 clears the user mid-session, the same redirect runs and remembers the page the user was on.

**`features/auth/LoginPage.tsx`.** After `login`, `navigate(returnTo, { replace: true })` where `returnTo` is `location.state?.from` if it is a string starting with `/` (and not `/login`), else `/` (AC 9). The guard avoids an open redirect through a crafted history state.

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

- `closeCommand` is the single close payload (AC 5): `id, action, broker, symbol, ticket, lots`, no `sl`/`tp`. The backend treats them as optional for `close` and the EA's `StringToDouble(ExtractField(json, "sl"))` yields 0 when absent, so `command.json` behaves identically.
- `Position.broker` is optional in the type; an empty broker is rejected by the backend with a 400 that the caller toasts, which is the honest outcome (today the same situation sends `undefined` and gets the same 400).
- `sendCommand` returns the id so `NewTradePanel` keeps registering pending ids before the POST (it generates the id itself via `newCommandId()` and builds the `Command`, then calls `sendCommand`).

**Call sites.** `ChartPage.handleModifyPosition` → `sendCommand(modifyCommand(pos, sl, tp)).catch(err => addToast(errorMessage(err, 'Network error sending modify'), 'error'))`. `ClosePositionPanel`, `OpenPositions.confirmAndClose` → `await sendCommand(closeCommand(position))`. `BulkEditPanel` → `modifyCommand(p, sl ? parseFloat(sl) : p.sl, tp ? parseFloat(tp) : p.tp)` per position; `JournalPage.handleBulkClose` → `closeCommand(p)` per position; both switch from `Promise.all(fetch…)` + `filter(!ok)` to `Promise.allSettled(cmds.map(sendCommand))` + `filter(status === 'rejected')`, keeping the toast text `N of M commands rejected: <first reason>`. `NewTradePanel` drops its local `sendCommand` and `generateId`; `action` state is typed `CommandAction`. The five `generateId` functions and the inline template in `ChartPage` are deleted (AC 6).

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

`useAlerts` becomes `const { items: alerts, refresh, mutate } = useRemoteList<PriceAlert>('/alerts')` plus `create = (a) => mutate(() => apiSend('/alerts', 'POST', a))`, `toggle = (a) => mutate(() => apiSend(`/alerts/${a.id}`, 'PUT', { enabled: !a.enabled }))`, `remove = (id) => mutate(() => apiSend(`/alerts/${id}`, 'DELETE'))`; it returns `{ alerts, refresh, create, toggle, remove }` as today. `useEmaAlerts` is the same over `/ema-alerts` (AC 8). A failed load still reads as `[]`; a 401 still goes through the handler before the `catch`. The mount load gains an abort on unmount, which the old hooks lacked.

## Migration of the remaining calls

Mechanical, file by file, preserving each site's current handling:

| File | Calls | Notes |
|---|---|---|
| `features/chart/ChartPage.tsx` | 9 | `/chart-indicators` GET/PUT, `/settings`, `/balances`, `/symbols`, `/positions/live`, `/candles` ×2, `/drawings` GET/PUT. Sites that did `r.json()` without an `ok` check now reject on non-OK and fall into their existing `.catch(() => {})` instead of storing an error body as data |
| `features/journal/*` | 10 | `Accounts` (`/balances`, `/balances/daily-pnl`), `ClosedPositions`, `ColorBadge` (PATCH), `NewTradePanel` (`/settings`, `/balances`, `/symbols` ×2, `/setup-levels`), `OpenPositions` snapshot |
| `features/settings/SettingsPage.tsx` | 3 | GET ×2, PUT |
| `features/scanner/ScannerPage.tsx`, `features/stats/StatsPage.tsx` | 3 | GET |
| `lib/*` | 8 | `useBalances`, `useBuildInfo` (`/version` is public; sending the cookie is harmless), `useDisplaySettings`, `usePush` ×3, `useScanner` (keeps its controller; `res.ok ? … : EMPTY` becomes `catch` → `EMPTY`) |

Rules applied everywhere: keep the `signal`, keep the `catch` outcome, replace `if (!res.ok) throw new Error(await errorFrom(res))` by nothing (apiFetch throws), replace `throw new Error('Failed to load trades')`-style fixed messages by the `ApiError` message. End state: `grep -c "fetch(" src/**` finds only the one inside `apiFetch` (AC 10).

## Data flow

Frontend-only. The `POST /commands` body sent for `close` loses `sl: 0, tp: 0` from two of the three paths; the backend and the EA accept both forms. No other wire change; the EA ↔ backend contract is untouched.

## Risks

- **Behaviour change on non-OK GETs.** Sites that parsed the body without checking `ok` could previously store an error object as data (e.g. `setEmas(undefined)`). After migration they reject and keep the previous state. This is the intended direction (spec 016) but it is a change: covered by the production pass of every page.
- **401 during a bulk action.** Several commands in flight hitting 401 call the handler several times; `setUser(null)` is idempotent and `ProtectedRoute` navigates once.
- **Login error text.** `errorFrom` reads `error ?? message`; the login route returns `message`. Verified by a wrong-password attempt showing the backend's text.
- **History state.** `from` is validated to be an internal path; a missing or foreign value falls back to `/`.
- **Scope size.** ~50 call sites across 20 files; mitigated by the file-by-file order, one commit per group, and the `grep` gate at the end.

## Verification

- `npx eslint .` · `npm run build` after each task; `git grep -n "fetch(" frontend/src` → 1 hit; `git grep -n generateId frontend/src` → 0 hits.
- Local stack: delete the `token` cookie in DevTools while on `/chart?broker=…&symbol=…`, trigger any call → `/login`; log in → back on the same chart URL with its query (AC 1, AC 9). Open `/journal?tab=open` logged out → login → journal with the tab.
- DevTools Network: close one position from the chart panel, from a journal row and via bulk close → three `POST /commands` with the same key set (AC 5); New Trade manual and mirror still produce one POST per broker with `pendingIds` resolving on `command_result`.
- Alerts panel: create / toggle / delete a price alert and an EMA alert; a rejected create (e.g. invalid price) toasts the backend text and the list refreshes (AC 8).
- Production pass: `/chart`, `/journal` (open, closed, accounts, colors), `/settings` save, `/scanner`, `/stats`, push subscribe/unsubscribe, footer build numbers (AC 11).
