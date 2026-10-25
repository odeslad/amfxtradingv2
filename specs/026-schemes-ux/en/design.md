# 026 — Schemes page UX · Design

## Approach

A layout rework inside `features/book/`, reusing the Journal's two established patterns instead of new
ones: the hover row actions of the Positions table (desktop) and the Positions card with swipe actions
(mobile). No API, type or calculation changes; `useBook`, `lib/book.ts`, `SchemePanel`, `TradePanel` and
`ConfirmPanel` are used as they are. The Spanish copy stays.

## Desktop

### Header and totals (AC 1, AC 2) — `BookPage.tsx` + `.module.css`

- The `<h1>` + year `<select>` become a tab bar with the Journal's tab classes copied into
  `BookPage.module.css` (`.tabBar`, `.tab`, `.tabActive`): one tab per `data.years` plus **Todos**,
  `selectYear` on click; **+ Nuevo esquema** moves to `.tabBarRight` as the green outlined `newBtn`
  (Settings 023 style).
- The seven tiles become one `.strip` (flex, separators via `border-left`): Esquemas with "· N en curso",
  Ganados, Empates, Perdidos, % ganados, then Neto € and Neto R pushed right (`margin-left: auto`) at
  `--text-2xl`.

### Schemes and operations tables (AC 3, AC 4, AC 5) — `SchemesTable.tsx` + `.module.css`

- Scheme row columns: chevron, Esq., `Inicio → Fin` (one cell, "en curso" in gold), Operaciones,
  Resultado, Neto €, Neto R, plus an actions cell.
- Row actions are the Journal's: an `actionsCell` (`width: 0; padding: 0`) holding `rowActions` (absolute,
  right of the row) and `rowActionsInner` (translateX(100%) → 0 on `:hover`, 0.18 s), with `editBtn`
  (orange) and `closeBtn` (red) labelled Editar / Eliminar. The classes are copied into
  `SchemesTable.module.css` under the same names (no cross-feature CSS import), `tbody tr { position:
  relative }`. Clicks on the buttons stop propagation so they do not toggle the row.
- Operations table: Pos., Dir., Lotes, Entrada, Cierre (price), Apertura → Cierre (one cell), Pips, €,
  R, Saldo and the same actions cell; ticket, SL and note leave the table.
- `.badge` loses border, padding and radius: uppercase coloured text only.

### Pagination (AC 9) — `BookPage.tsx`

Desktop keeps the range text and page-size select; Anterior / Siguiente become compact ‹ › `pageBtn`s.

## Mobile

### Totals and header (AC 1, AC 2)

Below 768 px: tabs `flex: 1` as in Settings, **+ Nuevo esquema** a full-width 44 px row; the strip turns
into `.totalsMobile` (title line, 2-column Neto € 22 px / Neto R 28 px, 4-column counts under a divider).
Desktop and mobile markup are both rendered and switched by CSS, the pattern the rest of the app uses.

### Scheme cards (AC 6, AC 7) — new `SchemeCard.tsx` (+ `.module.css`)

Extracted from `SchemesTable`'s current card branch, which grows too big inline:

- Collapsed: a `<button>` header (▸ #N, result text) and a 3-column labelled grid Inicio / Neto € (15 px)
  / Neto R (28 px, `--text-3xl`), left border in the result colour.
- Expanded (▾): grid Inicio / Fin / Neto € / Neto R; a **Ver operaciones** button (count pill, "N en
  curso", ›; `white-space: nowrap`); then three 44 px buttons + Operación / Editar / Eliminar.
- Open state stays in `SchemesTable` (`openId`), as today.

### Operations panel (AC 8) — new `OperationsPanel.tsx` + `OperationCard.tsx` (+ `.module.css`)

- `OperationsPanel` uses the shared drawer chrome (`journal/BulkEditPanel.module.css`, full width on a
  phone like every panel) with title "Operaciones · esquema N", the list, and a 48 px orange **+ Nueva
  operación** in a footer. It is opened from `BookPage` (new `Panel` kind `operations` holding the scheme
  id) and reads the scheme from `data.schemes` on every render, so edits and deletes refresh it (AC 10).
- `OperationCard` mirrors `PositionCard`: `useSwipeActions` from `journal/utils/useSwipeActions` for the
  swipe and tap-to-expand; summary grid labels Posición / Entrada / R over values (R at `--text-3xl`,
  "en curso" in gold for open trades); expanded rows Lotes, Cierre, SL, Pips, €, Saldo, Apertura, Cierre,
  Ticket, Nota (`space-between` rows, `--text-xl`); swipe actions Editar (orange) / Eliminar (red) open
  the existing `TradePanel` and `ConfirmPanel` through `BookPage`'s handlers. Its CSS copies
  `PositionCard.module.css`'s card rules.
- While the operations panel is open, opening the trade or confirm panel stacks on top (both are
  `z-index: 50` drawers rendered later in the tree); closing them returns to the list.

### Pagination (AC 9)

Below 768 px: ‹ and › 44 px buttons at the ends, "page / pages · N por pág." centred; the page-size select
stays reachable on desktop only.

## Files

```
frontend/src/features/book/BookPage.tsx, BookPage.module.css        edit
frontend/src/features/book/SchemesTable.tsx, SchemesTable.module.css edit
frontend/src/features/book/SchemeCard.tsx (+ .module.css)            new
frontend/src/features/book/OperationsPanel.tsx                       new
frontend/src/features/book/OperationCard.tsx (+ .module.css)         new
```

## Mockup

Design artifact approved by the user on 2026-10-25: https://claude.ai/artifact/MHTftwXsiwx6JLtfbrDPBe.
Artboards: Esquemas · escritorio (tab bar, totals strip, scheme table with hover actions over the row
end, expanded operations in 10 columns), Esquemas · móvil (tabs, full-width new button, totals block,
collapsed cards, pagination), Esquemas · móvil, esquema abierto (expanded card, Ver operaciones, actions),
Esquemas · móvil, operaciones (full-screen panel with Positions-style cards: collapsed, swiped, expanded).

## Risks

- Two stacked drawers on a phone (operations panel + trade panel): if the stacking proves awkward the
  trade panel can replace the operations panel and reopen it on close; decided during implementation.
- The page-size select disappears on mobile; it keeps the last value chosen on desktop (stored as today).
