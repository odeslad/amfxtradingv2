# 016 · FE-01 — CI gate and visible errors · Design

> Status: **approved**

## Approach

Five frontend changes and one workflow change, all behaviour-preserving on the success path:

1. **Lint to zero** — fix the 33 problems in the code (no silencing).
2. **Honest mutations** — every `fetch` that writes checks `res.ok`, and the caller shows one error toast.
3. **Boundaries** — an app-level error boundary, an `unhandledrejection` toast, and a retry cap in `ChartErrorBoundary`.
4. **Two CSS defects** — `.label` in the pending cards, the undefined `*Desktop` classes.
5. **`check` job** in `deploy-frontend.yml`, `deploy` depends on it.

Nothing is shared yet beyond one tiny helper (`errorFrom(res)`) in `lib/api.ts`: FE-03 will fold these call sites into `apiFetch`/`sendCommand`. Toasts keep using the existing `lib/toast.ts` store.

## 1. Lint to zero (`[frontend]`)

The 33 problems, grouped by fix:

| Rule | Where | Fix |
|---|---|---|
| `no-useless-escape` ×4 | `LightweightChart.tsx:74`, `position.ts:156` | `[\-]` → put `-` last in the class |
| `no-empty` ×1 | `ws.ts:23` | `catch { /* malformed frame: ignore */ }` with a comment (ESLint accepts a commented block) |
| `react-refresh/only-export-components` ×1 | `AuthContext.tsx:57` | move `useAuth` to `features/auth/useAuth.ts`; update the 6 importers |
| `react-hooks/refs` ×5 | `useWs.ts:6`; `LightweightChart.tsx:1028-1031` | `useWs`: assign the ref inside `useEffect(() => { onMessageRef.current = onMessage; })`. Legend: `precisionRef.current` read during render → derive `const precision = getPricePrecision(symbol)` at render (pure, same value the effect stores at `:676`) |
| `react-hooks/exhaustive-deps` ×4 | `LightweightChart.tsx:644` | copy `emaSeriesRef.current` into a local at effect start and use it in the cleanup |
| | `LightweightChart.tsx:728` | the effect reads `symbol`/`timeframe` only through refs or not at all — read the body; either add them (if used) or drop the usage; **no refetch may be introduced** (verify with Network) |
| | `NewTradePanel.tsx:76` | `onClose` through an `onCloseRef` kept current in an effect (same pattern as `useWs`) |
| | `NewTradePanel.tsx:128` | depend on `activeMirrorKey = activeMirrorBrokers.join('|')` and `initialSymbol`; the body already guards by `mode`, so the fetch count is unchanged |
| `react-hooks/set-state-in-effect` ×18 | see below | three patterns |

### The 18 `set-state-in-effect`

The rule flags a `setState` reachable synchronously from an effect body. Three patterns cover all 18:

**(a) "Reset when a prop changes"** — the React-documented *adjust state during render* pattern:

```ts
const [prevOpen, setPrevOpen] = useState(open);
if (open !== prevOpen) {
  setPrevOpen(open);
  if (!open) { setSl(''); setTp(''); setSubmitting(false); }
}
```

Applied to `BulkEditPanel:21`, `ClosePositionPanel:20`, `NewTradePanel:92` (open → preselect) and `:162` (close → reset), `AlertsPanel:45` (broker/symbol → form), and in `ChartPage` to the three selection-change resets (`:300` `setLiveCandle(null)`, `:320` `setCandles([])`/`setHasMore`/`setChartLoading`, `:345` `setDrawings(null)`) collapsed into **one** block keyed on `${broker}|${symbol}|${timeframe}`. Same renders as today (the reset happens one render earlier, before paint, instead of after a commit).

**(b) "Initial value from the environment"** — lazy `useState` initializers:

- `usePush:36`: `useState<Status>(() => !isSupported() ? 'unsupported' : Notification.permission === 'denied' ? 'denied' : 'unknown')`; the effect keeps only the async `serviceWorker.ready` part.
- `JournalPage:43`: `filters` and `tab` initialised from `searchParams` in their initializers; the effect keeps only `setSearchParams({}, { replace: true })` (not a React state setter — not flagged), and the existing `eslint-disable` at `:46` is removed if the rule no longer fires.

**(c) "Start async work only"** — effects whose synchronous part sets loading/empty state:

- `ChartPage:203` and `NewTradePanel:101` (`!broker` → `setSymbols([])`, `setSymbol('')`): handled by pattern (a) on `broker`.
- `ClosedPositions:24` (`setLoading(true)`, `setError('')`): pattern (a) keyed on the filter bounds.
- `NewTradePanel:134` (`setSetup(null)`), `:149` (`setBid(null)`): pattern (a) keyed on `open|mode|broker|symbol`.
- `useAlerts:36`, `useEmaAlerts:44` (`useEffect(() => { refresh(); })`): the rule follows `refresh` into its synchronous `setAlerts` on the catch path. Rewrite `refresh` so every `setAlerts` sits after an `await` (`const list = await load(); setAlerts(list)`) — which it already does on the success path; the catch path becomes `setAlerts([])` after the awaited fetch rejects, equally after an `await`. If the rule still fires, start the load with `.then(setAlerts, () => setAlerts([]))` in the effect.

All 18 are verified by the only arbiter that matters: `npm run lint` at 0, plus a manual pass through the affected UI (open/close each panel, change broker/symbol/timeframe on the chart, deep-link to the journal, change the closed-trades filter) checking the behaviour is identical and, in Network, that no request is duplicated.

## 2. Honest mutations (`[frontend]`)

`lib/api.ts` gains one helper:

```ts
export async function errorFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
  return body.error ?? body.message ?? `Error ${res.status}`;
}
```

| Site | Today | Change |
|---|---|---|
| `ClosePositionPanel.tsx:28-41` | toasts "Close sent" regardless | `if (!res.ok) throw new Error(await errorFrom(res))` before the toast; the existing `catch` toasts the message |
| `OpenPositions.tsx:127-150` `confirmAndClose` | `try/finally`, no feedback | add `if (!res.ok) throw …` and a `catch` → `addToast(msg, 'error')`; on success keep silent as today (the WS `command_result` toast follows) |
| `BulkEditPanel.tsx:31-48`, `JournalPage.tsx:82-99` | `Promise.all` of fetches, success toast | collect `const results = await Promise.all(...)`; `const failed = results.filter(r => !r.ok)`; if any, toast `"${failed.length} of ${n} commands rejected: ${await errorFrom(failed[0])}"` and skip the success toast; else unchanged |
| `ChartPage.tsx:414-428` modify from drag | `.catch(() => {})`, ignores status | `.then(async res => { if (!res.ok) addToast(await errorFrom(res), 'error'); }).catch(() => addToast('Network error sending modify', 'error'))` |
| `NewTradePanel.tsx:72-73` | second error toast on `command_result` | remove the `addToast`; keep `setSubmitting(false)` (AppLayout already toasts every `command_result` error) |
| `SettingsPage.tsx:56-65` | `setSaved(true)` always | `if (!res.ok) { addToast(await errorFrom(res), 'error'); return; }` inside the `try`; `catch` → toast "Network error"; `setSaved` only on success |
| `useAlerts.ts` / `useEmaAlerts.ts` `create/toggle/remove` | no `res.ok`, no catch | `if (!res.ok) throw new Error(await errorFrom(res))`; `refresh()` still runs in `finally` so the list reflects the server. `AlertsPanel` already `await`s `onCreate`/`onCreateEma` in handlers: wrap those and `handleToggle`/`handleDelete`/the inline `onToggleEma` in `try/catch` → `addToast` |
| `ColorBadge.tsx:18` | optimistic, no check | on `!res.ok` or network error: `onColorChange(broker, ticket, color)` (revert) + toast |
| `ChartPage.tsx:174` `saveEmas` | no check | `if (!res.ok) addToast(await errorFrom(res), 'error')`; `catch` → toast |
| `AuthContext.tsx:45-48` `logout` | `setUser(null)` only after a 2xx | `try { await fetch(...) } finally { setUser(null); }` |

No change to request bodies or to the success toasts (AC 3, AC 9).

## 3. Boundaries (`[frontend]`)

- `app/AppErrorBoundary.tsx` — class component (React has no hook for `getDerivedStateFromError`), mounted in `Router.tsx` **inside** `BrowserRouter` around `<Routes>` so the fallback can render inside the app shell: a centred panel in design-system styles ("Something went wrong" · error message in `--font-mono` · a `Reload` button → `window.location.reload()`), `console.error` of the error. `AuthProvider` stays outside it (an error there has nothing to render into).
- `main.tsx` — `window.addEventListener('unhandledrejection', e => { console.error(e.reason); addToast(messageOf(e.reason), 'error'); })` where `messageOf` reads `Error.message` or falls back to "Unexpected error". One toast per rejection (AC 6).
- `ChartErrorBoundary.tsx` — add `attempts` to state; `componentDidCatch` schedules the auto-reset only while `attempts < MAX_AUTO_RETRIES` (3); beyond that, `render` shows a small fallback (`styles.chartFallback`: "Chart failed to render" + `Retry` button that zeroes `attempts` and `failed`). A `resetKey` change (symbol/timeframe) resets both. The transient "Value is null" case keeps recovering on the first frames as today (AC 7).

## 4. CSS defects (`[frontend]`)

- `JournalPage.module.css`: add `.pendingCardRow .label { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--muted); letter-spacing: var(--tracking-wide); text-transform: uppercase; }` — the same rule `PositionCard.module.css:160` uses, so pending cards match position cards (AC 8).
- `JournalPage.tsx:139-162`: the `*Desktop` spans have no style today (undefined class) and the `*Mobile` siblings are `display: none` at every width, so the desktop text is what shows everywhere. Remove the three undefined `className`s from the spans (the spans stay). Zero visual change.

## 5. Workflow (`[infra]`)

`.github/workflows/deploy-frontend.yml` gains a `check` job modelled on the backend's and `deploy` gets `needs: check`:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
  deploy:
    needs: check
    …(unchanged)
```

`npm run build` on the runner needs no `.env.production` (`VITE_API_BASE` is only read at runtime, empty is fine) and `__BUILD_FRONTEND__` falls back to 0 with a warning on a shallow checkout — harmless, the deploy still builds on the VPS with the full history. FE-10 adds `npm test` to this job.

## Data flow

Unchanged: same requests, same bodies, same WS messages. The only new network behaviour is *reading* the error body of failed responses.

## Files

| File | Change |
|---|---|
| `frontend/src/lib/api.ts` | `errorFrom` |
| `frontend/src/lib/useWs.ts`, `ws.ts`, `useAlerts.ts`, `useEmaAlerts.ts`, `usePush.ts` | lint fixes, error handling |
| `frontend/src/features/auth/AuthContext.tsx`, `useAuth.ts` (new) + 6 importers | `useAuth` moved; `logout` finally |
| `frontend/src/features/chart/ChartPage.tsx`, `LightweightChart.tsx`, `AlertsPanel.tsx`, `ChartErrorBoundary.tsx`, `ChartErrorBoundary.module.css` (new, or reuse `ChartPage.module.css`) | lint fixes, error handling, retry cap |
| `frontend/src/features/journal/*.tsx`, `utils/position.ts`, `JournalPage.module.css` | lint fixes, error handling, `.label`, `*Desktop` |
| `frontend/src/features/settings/SettingsPage.tsx` | save error |
| `frontend/src/app/AppErrorBoundary.tsx` (new), `AppErrorBoundary.module.css` (new), `Router.tsx`, `main.tsx` | boundary, rejection handler |
| `.github/workflows/deploy-frontend.yml` | `check` job |
| `reports/2026-10-08-frontend.md` | `Spec` column of FE-01 → `016` / `016 ✅` |

## Risks

- **A `set-state-in-effect` rewrite changes when a reset happens** (one render earlier). Mitigated by the manual pass per panel and by Network showing identical request counts; the rule itself is the regression test for the pattern.
- **Error toasts surface failures that were silent** — expected; they are real failures.
- **`check` job slows the deploy by ~1 min** — acceptable; it is what the backend already does.
- **Moving `useAuth`** touches 6 imports — mechanical, caught by `tsc`.

## Alternatives considered

- **Silence `set-state-in-effect` for the panels** — explicitly excluded by AC 2; the rule points at real cascading renders.
- **Introduce `apiFetch` now** — it would make this spec touch all 50 call sites; FE-03 does that on top of a green lint.
- **`errorElement` via `createBrowserRouter`** — would change the router API for one fallback; a class boundary is smaller.
- **Run the check on the VPS instead of the runner** — the VPS build already runs there; a failed lint on the VPS would still have reset and pulled the tree. The runner gate stops before anything touches the server.
