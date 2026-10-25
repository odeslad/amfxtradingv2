# 025 — Chart fixes · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [backend] | build + vitest + local backend | `npm run build` · `npm test` (103 tests, 4 new in `candle-close.test.ts`) · `npm run lint` · local backend on 3001, bridges off, production DB through the tunnel → `/health` 200 | ✅ pass | 1 | 0.75 |
| 2 [frontend] | build + lint + local app on the production API | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` (real ticks) | ✅ pass | 1.5 | 1.5 |
| 3 [db] | `prisma generate` + build + `migrate diff` against production | `npx prisma generate` · `npm run build` · `prisma migrate diff --from-url <production via tunnel> --to-schema-datamodel` | ✅ pass | 0.25 | 0.25 |
| 4 [backend] | build + tests + lint | `npm run build` · `npm test` · `npm run lint` | ✅ pass (end to end in task 7) | 0.25 | 0.25 |
| 5 [frontend] | build + lint + local app | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass (toggle 🕐 task 7) | 2.5 | 2.5 |
| 6 [frontend] | build + lint + local app at 390 px | `npm run build` · `npm run lint` · device mode in the local app | ✅ pass (iPhone ✅ task 7) | 1.5 | 0.75 |
| 7 [infra] | manual (user validation on production) | one push of `master` (8 commits, db + backend + frontend); both pipelines green in under a minute | ✅ pass | 0.5 | 0.5 |
| 8 [specs] | manual | this file, `Status: closed`, `git mv` to `archive/2026-10/` | ✅ pass | 0.25 | 0.25 |

**Total**: Est 7.75 SP · Actual 6.75 SP. Calibration: the toolbar and backend came in under estimate;
the drawing tools matched it once the cursor fix (a CSS rule, since the library owns its cursor) and the
label iterations with the user are counted. Not counted: the local login fix and the encoding repair,
both outside the spec.

## Evidence

### Task 1

`tsc` and `eslint` clean; the whole suite passes. The new tests cover the tracker: the first tick only
seeds, same-time ticks report nothing, an advanced `m5_time` closes the M5 bar with the previous tick's
open / high / low and its bid as close, an hour rollover closes M5 / M15 / H1 at once without touching
another symbol or broker, and a tick with a missing candle time is skipped. The rollover path itself
(upsert + `candle` broadcast) needs a live pipe, so it is checked on production in task 5.

### Task 2

Build and lint clean. Checked by the user in the local app against the production API on 2026-10-24:
EMA lines reach the live candle and move with the ticks, rollover lines stop at the candle pane when
the chart is scrolled right, alert markers update at once on create / toggle / delete (the last one
included). The `candle` message cannot be seen until the backend deploys (task 5). Side fix found while
testing: the dev proxy now rewrites the session cookie to host-only (`cookieDomainRewrite`), since
Chrome dropped the production `Domain=.amfxtrading.com` cookie arriving through the proxy and every
request bounced to the login; logout also clears the host-only scope on the backend.

### Tasks 3–4

AC 17 was added during implementation at the user's request. The production diff prints exactly:

```
ALTER TABLE "settings_display" ADD COLUMN "rectLabels" BOOLEAN NOT NULL DEFAULT true;
```

`/settings` takes an optional `display.rectLabels` and returns it (default `true`); the backend suite
and lint stay green. The toggle cannot reach the deployed backend before the push, so it is checked on
production in task 7.

### Task 5

Validated by the user in the local app on 2026-10-24: rectangle with eight handles and the centre cross,
each side and corner resizing its own edge, hand cursor over drawings and resize / move cursors on a
selected rectangle, top / bottom prices and the pips label in 9 px white with a black outline, orange
ring on selected markers and symbols, selected text in orange with no frame. Iterated on the user's
feedback (smaller numbers, pips moved to the bottom-left, white with outline). The cursor needed a CSS
rule on the chart container (`--draw-cursor` with `!important`): the drawing canvas ignores pointer
events and lightweight-charts sets its own cursor on its inner elements. The Rectangle labels toggle
cannot take effect against the deployed backend yet; it is validated on production in task 7.

### Task 6

Checked by the user in the local app on 2026-10-24: one 44 px row on a phone width (timeframe,
positions, alerts, filters, indicators, fullscreen, Draw), Draw opening and closing the second row of
eight tools, the row staying open after a drawing, desktop row unchanged, alerts panel Add buttons in
the orange primary style. The drawing tools share the second row (`flex: 1`) because eight fixed 44 px
buttons do not fit in 390 px. The iPhone itself is checked on production (task 7).

### Task 7

Pushed `b49c496..56512d0`; "Deploy Backend to VPS" and "Deploy Frontend to VPS" both succeeded
(2026-10-24 19:09 → 19:10 UTC), backend version 204, `/health` 200, migration `20261026000000_rect_labels`
applied by the deploy. Validated by the user on production, desktop and iPhone, against AC 1–17: mobile
toolbar and Draw row, rectangle handles, cursors, labels and the Rectangle labels toggle, marker / text
selection, alerts panel buttons and marker refresh, EMAs on the live candle, clipped rollover lines, and
the closed candle on the chart at the close and after a reload.

Outside the spec, shipped in the same push: `43b855c` (logout clears the host-only cookie) and
`6911fe6` (dev proxy keeps session cookies host-only), both from the local login loop found while
testing task 2.

### Task 8

Closed and archived under `archive/2026-10/`.
