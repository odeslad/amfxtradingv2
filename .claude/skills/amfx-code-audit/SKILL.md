---
name: amfx-code-audit
description: Full read-only audit of one or more layers of this monorepo (backend, frontend, ea) — architecture, coupling, duplication, performance, quality, technical debt — producing exactly two reports under reports/ — `<date>-<layer>.md` (how it works, diagnosis, ordered plan, technical annexes) and `<date>-<layer>-explained.md` (each improvement in plain language). Use for "auditoría", "evaluación", "revisión de arquitectura" or "informe de deuda técnica".
---

# amfx-code-audit

Arguments: `<layer(s)>` — `backend`, `frontend`, `ea`, or several (one pair of reports per layer; `all` = the three). Ask if missing. **Read-only**: never modify code, never run `npm install`, builds or tests, never touch `brokers.json`/`.env`.

The output is **two files per layer** under `reports/`, nothing else. Reference format: `C:/work/airplane/APS/reports/2026-09-25-ancillaries.md` and its `-explained.md`.

## 1. Prepare

1. Confirm `git status` is clean and note `master @ sha`; audit the working copy directly (no worktree — single repo, no long-path issue).
2. Baseline metrics with a node script (no external deps) in the scratchpad: code files and lines (excluding tests, `dist/`, `prisma/generated/`), the 25 biggest files, counts of `any`, `eslint-disable`, `@ts-ignore`, `TODO|FIXME`, `console.log`, React hooks per file (frontend), test files, package scripts and dependencies, tsconfig/eslint/prettier strictness, which pipeline steps (`.github/workflows`, `infra/`) run `test`/`lint`/`typecheck`, and a **module import graph** (fan-in/fan-out, bidirectional dependencies, `features → services/ws` and `services → features` edges in the frontend; `routes → services → prisma` layering and `engine/bridge/ws` coupling in the backend). For the EA (MQL4): files, includes, globals, functions by size, file/pipe I/O points. If a permission hook blocks the script, say so and fall back to `git grep`; never skip metrics silently.
3. **Data flow context.** Map how data enters and leaves the layer: EA → named pipe / `bridge/*.json` → backend → BD / WS → frontend; `bridge/command.json` back to the EA. Read the actual code, not `.claude/CLAUDE.md` alone — flag where the doc and the code disagree (the doc is used by every session, so drift is itself a finding).

## 2. Review (parallel, read-only)

Launch **Explore agents in one message**, each with a focused brief (~1200-1500 words, facts with `path:line`, snippets only where they prove a point, prioritized behaviour-preserving improvements: *what / where / why / risk / effort S-M-L*). Adapt the briefs to the layer:

**backend** (4 agents): (1) architecture and lifecycle — startup, per-broker PipeReader/FileWatcher, WS broadcast, auth/JWT/cookies, env/config handling, error and reconnect paths, shutdown; (2) data and persistence — Prisma schema vs usage, sync jobs (`syncPositions`, trades, balances, candles), transactions, race conditions between brokers (known: duplicate balance records), query patterns, migrations; (3) API and contracts — routes, validation, typing of EA JSON, WS message shapes vs what the frontend expects, engine/bridge command writing; (4) quality — tsconfig/eslint, `any` clusters, tests, logging, dead code (engine/backtest remnants), deploy script and pipeline gates.

**frontend** (4 agents): (1) architecture and state — routing, auth, WS client (reconnect, broker injection, message typing), data fetching, shared hooks/context; (2) features and duplication — inventory per feature (journal, stats, accounts…), repeated table/card patterns, component size and responsibilities, mobile/desktop copies; (3) design system compliance — CSS Modules using the `.claude/CLAUDE.md` variables vs magic values, inline styles, numeric inputs without spinners, iOS gotchas (dates, pinch-zoom); (4) performance and quality — rendering (context values, effects, keys, chart re-creation), bundle (deps, chunks), tsconfig/eslint, tests, build config.

**ea** (2 agents): (1) structure and I/O — tick/positions pipe writer, bridge file writers/readers, command polling, result writing, timers and intervals, error handling, reconnection to the pipe; (2) quality — globals, duplicated code, magic numbers, dead paths (e.g. the pending removal of `positions.json` writing), contract drift vs the backend parser.

No style nitpicks ESLint/Prettier already cover.

## 3. Verify before escalating

An agent's finding is a lead, not a verdict. Before calling something a bug or urgent, read the code yourself: who calls it and where it runs (startup vs per-tick vs per-30s sync); whether production evidence contradicts it (ask the user); the actual call sites for "dead code" claims; the full set of `if (broker …)`/per-broker branches for behaviour-per-broker claims. State severity **with its reason**. Separate "urgent and technical" from "needs the user's confirmation with production data".

## 4. Report 1 — `reports/YYYY-MM-DD-<layer>.md`

Spanish, single document, same structure as the APS reference:

```
# <Layer> — Estado, diagnóstico y plan de mejora
> fecha · master @ sha · revisión de solo lectura: N archivos, N líneas, sin build ni tests · 1 SP = 1 h senior

## Parte I — Cómo funciona hoy      (descriptive; mermaid flowcharts of data flow, lifecycle, state; the riskiest mechanism explained)
## Parte II — Diagnóstico           (A..G, most important first, one paragraph each with the number that backs it)
## Parte III — Qué proponemos
### Mejoras, en orden de valor por hora   (table # · mejora · qué resuelve · SP; recommended block with total)
### Refactors clave                 (design sketch, steps without breaking anything)
### Qué no proponemos ahora, y qué lo haría entrar
### Cómo sabremos que ha servido
### Base de la estimación           (calibrate with Est vs Actual of archive/*/*/en/verification.md or the Actual effort sections of tasks.md; recommend the first 2-3 items as /amfx-spec-new specs)
### Qué esperar al terminar
## Anexo A — Referencias por hallazgo (finding → path:line)
## Anexo B — Detalle de cada mejora   (Problema · Cambio · Verificación · Riesgo)
## Glosario
```

Mermaid rules: quote every node label, no `{}`/`()` inside labels, no `{` in sequence messages.

## 5. Report 2 — `reports/YYYY-MM-DD-<layer>-explained.md`

Spanish, ~500 words per improvement, same numbering as the plan table. **No file paths, no code, no analogies**: explain the real mechanism from zero. Per improvement: **La pieza** · **Cómo funciona hoy** · **Qué está mal** · **Qué pasaría si no se toca** · **Qué se cambia** · **Cómo se hace sin romper nada** · **Cómo sabremos que está bien** · **Ojo**. Close with "Cómo encajan las N".

## 6. Finish

- Reports link each other in their headers. Ask before staging; commit both in one commit: `docs(reports): add code audit of <layer>`.
- Tell the user in one line each: the causes (Diagnóstico A..G), the riskiest mechanism, the recommended block (SP), and what could not be done (blocked scripts, unverified findings).
- If a finding contradicts `.claude/CLAUDE.md`, list the doc lines to fix in the summary; do not edit the doc inside the audit.
