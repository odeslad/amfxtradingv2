# 017 · FE-02 — Stale response cancellation · Design

## Approach

One pattern, applied by hand at each site, with no new abstraction beyond a two-line helper:

```ts
useEffect(() => {
  const ac = new AbortController();
  fetch(url, { credentials: 'include', signal: ac.signal })
    .then(…)
    .catch(err => { if (!isAbortError(err)) …; });
  return () => ac.abort();
}, [deps]);
```

- `AbortController` is preferred over a `cancelled` flag because it also frees the connection and stops the body download; both satisfy the acceptance criteria.
- An aborted request is **silent**: the cleanup runs because the inputs changed (the render-time reset already put the new loading state in place) or the component unmounted, so the `catch` must not touch state. `isAbortError(err)` goes to `lib/api.ts` next to `errorFrom`/`errorMessage`:

```ts
export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';
```

- Where the request is not tied to an effect (load-more, scanner `run`), the controller lives in a `useRef` and the previous one is aborted before starting the next request; a dependency change or unmount aborts the pending one.

FE-03 will later replace these `fetch` calls with `apiFetch<T>(path, { signal })`; the signals stay where this spec puts them.

## Changes per file

### `features/chart/ChartPage.tsx`

**Candles effect** (`:347-368`). Add the controller. On success, unchanged. `catch`: `if (!isAbortError(err)) setChartLoading(false)` — on abort, the render-time reset (`:318-324`) has already set `chartLoading` for the new selection and the new effect's response will clear it.

**Drawings effect** (`:370-377`). Add the controller; `catch`: `if (!isAbortError(err)) setDrawings([])`. With the stale response gone, `drawings` stays `null` until the right response arrives, so `initialDrawings` never carries a previous symbol's items and `saveDrawings` cannot persist them under the new symbol (AC 2).

**Symbols effect** (`:215-225`). Add the controller and replace the `initSymbol` guard with a functional update that keeps the current symbol when the new broker lists it (AC 5):

```ts
setSymbol(prev => list.includes(prev) ? prev : list.includes('EURUSD') ? 'EURUSD' : list[0] ?? '');
```

The effect then depends only on `broker` and the `eslint-disable` on `:224` goes away. Side effect worth knowing: on first mount a stored or deep-linked symbol that the broker does not list is now replaced instead of leaving the chart empty.

**Chart positions effect** (`:332-345`). Add the controller; `catch` stays `() => {}` (already silent) — the abort just stops the `.then` from running (AC 6).

**Load-more** (`:395-416`). Store the controller in `loadMoreAcRef`. `loadMoreCandles` creates it and passes its signal; the candles effect's cleanup (which runs on every selection change and on unmount) calls `loadMoreAcRef.current?.abort()`. A load-more that completes after a selection change therefore rejects with `AbortError` and is dropped (AC 3); the existing `finally` releases `isLoadingMoreRef` in every case.

### `features/chart/LightweightChart.tsx`

Remove the component's own `isLoadingMoreRef` (`:230`, `:614-618`, `:714`). It duplicates `ChartPage`'s guard — `loadMoreCandles` returns synchronously when a request is in flight — and is the one that sticks: it is only released when new candles are prepended, so an empty page or a failed request freezes infinite scroll until remount. `subscribeVisibleLogicalRangeChange` keeps calling `onLoadMoreRef.current()` when `range.from <= 30`; the page-level guard absorbs the burst of range events during a scroll (AC 4). When `hasMore` turns false, `onLoadMore` is `undefined` and nothing fires.

*Alternative considered:* make `onLoadMore` return a `Promise<void>` and release the chart's ref in its `finally`. Rejected: two guards for one request, and the chart would need to handle a prop that may be sync or async.

### `features/journal/OpenPositions.tsx` (`:57-77`)

Add the controller (aborted on unmount). To keep the REST snapshot from overwriting a WebSocket message that arrived first (AC 7), track the brokers already refreshed by the WS in `wsBrokersRef: useRef(new Set<string>())` — `handleWsMessage` adds `msg.broker` — and apply the snapshot per broker, skipping those in the set:

```ts
const fresh = all.filter(p => !wsBrokersRef.current.has(p.broker!));
if (fresh.length > 0) setPositions(prev => [...prev, ...fresh].sort(byBrokerThenTime));
```

The snapshot runs once on mount, so at that point `prev` only holds positions delivered by the WS; appending the brokers the WS has not refreshed yet cannot duplicate anything. The color map is applied the same way (only for brokers not yet refreshed by the WS). The sort comparator is extracted to a local `byBrokerThenTime` since it is already duplicated between the snapshot and the WS handler.

### `features/journal/ClosedPositions.tsx` (`:32-44`)

Add the controller. `catch`: `if (!isAbortError(err)) setError(err.message)`; `finally` becomes `.then(() => setLoading(false))` placed after the catch guarded the same way — simplest form:

```ts
.then(setTrades)
.catch(err => { if (isAbortError(err)) return; setError(err.message); })
.finally(() => { if (!ac.signal.aborted) setLoading(false); });
```

The render-time reset (`:27-31`) already sets `loading = true` for the new range, so an aborted request must not clear it (AC 8).

### `lib/useScanner.ts` (`:43-60`)

`run` becomes:

```ts
const acRef = useRef<AbortController | null>(null);
const run = useCallback(async (params) => {
  if (!params.broker) return;
  acRef.current?.abort();
  const ac = new AbortController();
  acRef.current = ac;
  setLoading(true);
  try {
    const res = await fetch(url, { credentials: 'include', signal: ac.signal });
    if (ac.signal.aborted) return;
    setResult(res.ok ? await res.json() : EMPTY);
  } catch (err) {
    if (!isAbortError(err)) setResult(EMPTY);
  } finally {
    if (acRef.current === ac) setLoading(false);
  }
}, []);
useEffect(() => () => acRef.current?.abort(), []);
```

Only the latest run writes `result` and clears `loading` (AC 9). The unmount cleanup aborts a run left in flight when leaving the page.

### `lib/api.ts`

Add `isAbortError`.

## Data flow

Frontend-only; no change to any backend endpoint, WS message or EA bridge. The EA ↔ backend contract is untouched.

## Risks

- **Drawings saved before the load completes.** Pre-existing: if the user draws on a symbol before its `GET /drawings` returns, the PUT carries only the new drawing. This spec removes the stale-load path (the corrupting one) and does not change that race; it is noted for FE-03/FE-05. Verification of AC 2 compares `GET /drawings` for both symbols before and after the test to prove nothing was lost.
- **Dropping the chart's load-more guard.** `loadMoreCandles` may now be called many times per scroll; each call is a synchronous early return while a request is pending, so there is no cost. Verified by scrolling to the left edge repeatedly with the Network tab open: one `before=` request per page.
- **Symbol re-pick on mount.** A deep link with a symbol the broker does not list now lands on EURUSD or the first symbol instead of an empty chart; the URL is rewritten by the existing selection-persist effect. Intended, but visible.
- **AbortError shape.** In browsers an aborted `fetch` rejects with a `DOMException` named `AbortError`; `isAbortError` checks both so a future test environment that throws a plain `Error` is not silently swallowed as a real failure.

## Verification

- `npx eslint .` and `npm run build` in `frontend/` (AC 11).
- DevTools Network throttling "Slow 3G": switch symbol three times in a row — chart, drawings and legend belong to the last one; `GET /drawings` for the previous symbols unchanged (AC 1, AC 2).
- Scroll to the oldest candle until `before=` returns `[]`, then change timeframe and scroll left again: load-more requests resume (AC 4). Block `/candles?…before=` in DevTools, scroll left, unblock, scroll left: a new request fires (AC 4).
- Switch to a broker without the current symbol: chart shows EURUSD or the first symbol; switch to one that lists it: symbol kept (AC 5).
- Throttled journal: change the date range twice quickly — the table shows the last range and the spinner clears only once (AC 8). Scanner: edit EMA numbers quickly — one result, `loading` ends with the last run (AC 9).
