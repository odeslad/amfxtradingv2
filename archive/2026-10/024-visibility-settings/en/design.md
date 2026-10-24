# 024 — Hide brokers and symbols from Settings · Design

## Approach

Two lists saved with the global display settings and one frontend store that every list-rendering
component consults. No new endpoint: `GET /settings` / `PUT /settings` gain a `visibility` object. The
store is an external store (`useSyncExternalStore`, the pattern of the live positions feed) loaded
once per session and refreshed when Settings saves, so a change propagates to the open pages without a
reload. Filtering happens at the edges (the lists and rows a component renders), never in the feeds, so
hidden brokers keep their positions, alerts and notifications flowing.

Alternative considered: per-device `localStorage` — rejected by the user (must follow between PC and phone).

## Data (db)

Migration `20261025000000_visibility`: `settings_display` + `hiddenBrokers TEXT[] NOT NULL DEFAULT '{}'`
and `hiddenSymbols JSONB NOT NULL DEFAULT '{}'`. Prisma: `hiddenBrokers String[] @default([])`,
`hiddenSymbols Json @default("{}")`. `prisma migrate diff` against production must print exactly this.

## Backend

`routes/settings.ts`: `parseVisibility(value)` → `{ hiddenBrokers: string[], hiddenSymbols: Record<string,
string[]> }` (arrays of non-empty strings, trimmed, de-duplicated, symbols upper-cased; the object's keys
are brokers); `PUT` accepts an optional `visibility` and upserts it with the display row; `GET` and
`PUT` answer `visibility` next to `display` (defaults `[]` / `{}`). Unknown brokers / symbols are kept
as given (AC 2). Docs: `architecture.md` settings table line and `.claude/CLAUDE.md` models note.

## Frontend

### `lib/visibility.ts` (external store)

```ts
interface Visibility { hiddenBrokers: string[]; hiddenSymbols: Record<string, string[]> }
loadVisibility()                     // GET /settings → store (called once from AppLayout)
setVisibility(v)                     // after Settings saves
useVisibility(): Visibility          // useSyncExternalStore
isBrokerVisible(v, broker)           // pure helpers, also usable outside React
isSymbolVisible(v, broker, symbol)
visibleBrokers(v, brokers)           // keeps order
visibleSymbols(v, broker, symbols)
```

Brokers compared as given by the API (same strings everywhere); symbols upper-cased.

### Settings: Visibility tab

`features/settings/VisibilityTab.tsx`: table (Broker, Visible toggle, Account, Symbols count, Symbols
button) on desktop, stacked rows with the button under them on mobile (`SettingsPage.module.css`
patterns). State lives in `SettingsPage` next to mirror / display (`visibility` form state, `dirty`,
one Save → `PUT /settings { mirror, display, visibility }` → `setVisibility(saved)`). Symbol counts
need each broker's symbol list: fetched lazily per broker the first time its row renders
(`/symbols?broker=`), cached in the tab.

`features/settings/SymbolsPanel.tsx` (+ `.module.css`): right-side panel over `BulkEditPanel.module.css`
chrome: title "Symbols · BROKER", search input, "N symbols · M hidden", Show all / Hide all, one row per
symbol (checkbox, name struck through when hidden, state label) with 16 px padding before the scrollbar;
44 px rows on mobile. Toggling updates the form state at once (dirty); nothing is sent until Save.

### Applying the visibility

| Place | Change |
|---|---|
| `AppLayout` | `loadVisibility()` on mount |
| `journal/Accounts` | balances filtered by `isBrokerVisible` before sort / render |
| `journal/OpenPositions`, `PendingOrders` | the subscribed list filtered by broker + symbol before filters / options / group |
| `journal/ClosedPositions` | trades filtered by broker + symbol; filter options from the visible set |
| `chart/ChartPage` | `brokers` / `symbols` passed to the toolbar and filters panel pass through `visibleBrokers` / `visibleSymbols`, plus the current selection appended with a `hidden` flag when it is hidden (AC 5); the auto-pick of a broker / symbol skips hidden ones |
| `chart/ChartToolbar`, `ChartFiltersPanel` | option label "EURGBP · hidden" for the flagged entry |
| `journal/NewTradePanel` | broker list and symbol list (for the chosen broker) filtered; mirror targets untouched |
| `stats/StatsPage` | broker selector filtered |
| `settings/NotificationPanel` | broker select and symbol chips filtered |
| `settings/MirrorTab`, `DevicesPanel` | untouched (AC 3) |

`useEmaNotifications` rows, alerts, the live feed and the WS toasts are not filtered (AC 6).

### Files

```
backend/prisma/migrations/20261025000000_visibility/migration.sql   new
backend/prisma/schema.prisma, src/routes/settings.ts                 edit
backend/docs/architecture.md, .claude/CLAUDE.md                     edit
frontend/src/lib/visibility.ts                                      new
frontend/src/features/settings/VisibilityTab.tsx, SymbolsPanel.tsx (+ .module.css)  new
frontend/src/features/settings/SettingsPage.tsx (+ .module.css)     edit
frontend/src/app/layout/AppLayout.tsx                               edit
frontend/src/features/journal/Accounts.tsx, OpenPositions.tsx, PendingOrders.tsx, ClosedPositions.tsx, NewTradePanel.tsx  edit
frontend/src/features/chart/ChartPage.tsx, ChartToolbar.tsx, ChartFiltersPanel.tsx  edit
frontend/src/features/stats/StatsPage.tsx                           edit
frontend/src/features/settings/NotificationPanel.tsx                edit
```

## Mockup

Design artifact approved by the user on 2026-10-23: https://claude.ai/artifact/A2QMEiAjP25c2ySHxcRth3.
Artboards: Settings · Visibility desktop (table with Visible toggle, account, counts, Symbols button),
Settings · Visibility mobile (stacked rows with the Symbols button), Symbols panel desktop (right,
floating: search, Show all / Hide all, checkbox rows, thin dark scrollbar), Symbols panel mobile (full
width, 44 px rows), chart selectors with a hidden selection marked "· hidden".

## Risks

- A page that lists a broker from a source other than `/balances` would miss the filter: every list
  source is enumerated in the table above (checked with `git grep` for `/balances` and `/symbols`).
- The chart's stored selection may point at a hidden pair after a save on another device: AC 5 keeps
  it visible and marked until the operator changes it.
- Group buttons on Positions / Orders count visible rows only, so a hidden broker's positions never
  enter a bulk close by accident.
