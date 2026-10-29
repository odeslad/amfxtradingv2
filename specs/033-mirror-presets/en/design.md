# 033 — Mirror presets · Design

## Approach

The single mirror configuration (`settings_mirror`, one row per broker) becomes a list of named presets. Each preset stores its per-broker configuration as JSON, validated by the same `parseMirror` used today. `/settings` returns and saves `presets` instead of `mirror`, keeping the page's single Save. New Trade picks a preset and builds the orders from it exactly as it does today from `mirror` (`NewTradePanel.tsx:231`): the commands to the EA do not change.

## Data flow

```
settings_mirror (today) ──migration──▶ mirror_presets { "Default", brokers: [...] }
mirror_presets ──GET /settings (presets)──▶ Settings › Mirror (edit list) ──PUT /settings (presets)──▶ mirror_presets
mirror_presets ──GET /settings──▶ New Trade: preset select ──▶ one command per enabled broker of the preset (unchanged)
```

No EA ↔ backend contract change.

## Per layer

### db
- New model `MirrorPreset` → table `mirror_presets`: `id Int @id`, `name String @unique`, `position Int`, `brokers Json` (array of `{ broker, enabled, lotsMode, lots }`), `updatedAt`.
- Hand-written migration `20261030000000_mirror_presets`:
  1. `CREATE TABLE "mirror_presets"`.
  2. `INSERT` one preset `Default`, position 0, with `brokers` built from every `settings_mirror` row (`json_agg` ordered by broker). Inserted even when `settings_mirror` is empty (`[]`), so there is always one preset.
  3. `DROP TABLE "settings_mirror"` and remove `SettingsMirror` from `schema.prisma`.

### backend (`src/routes/settings.ts`)
- GET: `presets: [{ id, name, brokers }]` ordered by `position`; `mirror` disappears from the response.
- PUT: `presets` replaces the whole list in one transaction (delete the ones not sent, upsert the rest by `id`, `position` = array index). Validation: array of 1+ items, unique non-empty names (trimmed, max 40 chars), each `brokers` through `parseMirror`. An empty list → 400 (AC 9).
- Tests for the parser: valid list, empty list → 400, duplicate names → 400, bad broker item → 400.

### frontend
- **Settings › Mirror** (`MirrorTab.tsx`, `SettingsPage.tsx`):
  - A row of preset chips above the table; the selected chip is the preset being edited. `+ New` adds a preset copied from the selected one (name "New preset"). The name is editable in an input; a `Delete` button removes the selected preset (disabled when only one is left).
  - The broker table / cards below are today's, bound to the selected preset. Each preset is merged with the connected brokers (`/balances`) as today, so a new broker appears disabled.
  - Save sends `presets` with the rest of the settings.
- **New Trade** (`NewTradePanel.tsx`):
  - In mirror mode, a `Preset` select above the broker list; the list shows the selected preset's enabled brokers and lots. Selection kept in `localStorage` (`amfx.mirrorPreset`, by preset id), falling back to the first preset (AC 6, AC 7).
  - "No brokers enabled for mirror" now refers to the selected preset (AC 8); the Mirror button stays enabled while some preset has an enabled broker.
  - Symbols, both modes (AC 10): filtered with `isVisible(visibility, broker, symbol)` (`lib/visibility.ts`); in mirror mode a symbol must be common to and visible in every enabled broker of the preset.
  - Default symbol (AC 11): chart symbol if in the list, else `EURUSD` if in the list, else none.
- No dependencies added.

## Alternatives

- **Two relational tables** (`mirror_presets` + `mirror_preset_brokers`): stricter schema, but twice the migration and upsert code for a list that is always read and written whole. Rejected; the JSON is validated in the route as today's rows are.
- **Keep `settings_mirror` as the "default" and add presets apart**: two places to configure the same thing. Rejected by the user in the requirements.
- **Keep returning `mirror` for compatibility**: avoids the gap between the backend and frontend deploys, at the cost of dead code to remove later. Rejected: the gap is minutes and only affects New Trade and Settings until the frontend deploys.

## Risks

- **Deploy gap**: between the backend deploy and the frontend deploy, the old frontend reads `mirror` (now missing), so Settings › Mirror shows "No brokers connected" and New Trade has mirror disabled. Deploy the frontend right after the backend; manual trading keeps working.
- **The migration drops `settings_mirror`**: its data is copied first in the same migration. `prisma migrate diff` against production must stay empty.
- `localStorage` may be unavailable: fall back to the first preset.

## Mockup

Approved 2026-10-29: https://claude.ai/artifact/WKDKFYHu87AVkTXeArc8Jm

Artboards: desktop Settings › Mirror editing a preset · mobile Settings › Mirror · Settings › Mirror with one preset (Delete disabled) · desktop New Trade mirror mode · New Trade preset with no enabled broker · mobile New Trade mirror mode.
