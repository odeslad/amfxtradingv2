# 026 — Schemes page: mobile and desktop UX

> Status: **closed**

## Context

The Schemes page (the operator's manual scheme book, spec 020) works but reads poorly. On a phone the
scheme cards use 12–13 px text, actions are 9 px text links, the seven totals tiles take half the screen,
the pagination row does not fit, and the operations of a scheme cannot be edited or deleted at all (the
expanded card only lists them). On desktop the operations table has 15 columns and scrolls sideways, the
row actions are faint grey links and the header (big title + year select) differs from the rest of the
app. This spec reworks the layout only: the data model, the R / balance calculations, the API and the
Spanish copy of the page stay as they are.

## Affected layers

- frontend

## User stories

- As an operator on the phone, I want to read a scheme's result at a glance and open its operations as
  cards like Positions, so that I can review and fix them without a desktop.
- As an operator on desktop, I want a compact header, totals and operations table, so that the whole
  scheme fits on screen without scrolling sideways.

## Acceptance criteria

- AC 1. WHEN the page opens THEN the header is a tab bar like the Journal's with one tab per year plus
  **Todos**, the active one blue, and a **+ Nuevo esquema** green outlined button on the right (desktop);
  on a phone the tabs fill the width and the button sits under them at full width, 44 px tall.
- AC 2. WHEN the totals show on desktop THEN they are one strip with separators: Esquemas (with "· N en
  curso"), Ganados, Empates, Perdidos, % ganados, and Neto € and Neto R larger on the right. On a phone
  they are one block: a small "N esquemas · M en curso" title, Neto € (22 px) and Neto R (28 px) in two
  columns, and Ganados / Empates / Perdidos / % ganados in four equal labelled columns under a divider.
- AC 3. WHEN a scheme row shows on desktop THEN its columns are: chevron, Esq., Inicio → Fin (one
  column), Operaciones, Resultado, Neto €, Neto R; the **Editar** (orange) / **Eliminar** (red) 27 px
  buttons take no column: the data columns stretch to the right edge and the buttons slide in over the
  row's right end when the pointer is over it, exactly like the Positions rows of the Journal.
- AC 4. WHEN a desktop scheme is expanded THEN its operations table has only Pos., Dir., Lotes, Entrada,
  Cierre, Apertura → Cierre, Pips, €, R, Saldo, with the same hover Editar / Eliminar as AC 3; ticket, SL and note are
  shown only in the edit panel; **+ Nueva operación** stays on the block's header.
- AC 5. WHEN the result of a scheme or operation is shown (En curso, Ganado, Perdido, Empate) THEN it is
  coloured uppercase text with no border or background, so it never looks like a button.
- AC 6. WHEN the scheme list shows on a phone THEN each collapsed card has ▸ #number, the result and three
  labelled values in equal columns: Inicio, Neto €, Neto R (Neto R at 28 px, like the Positions P&L; the
  others at 15 px), with the left border in the result's colour.
- AC 7. WHEN the operator taps a phone card THEN it expands (▾) to a labelled grid (Inicio, Fin, Neto €,
  Neto R at 28 px), a **Ver operaciones** button (count in a pill, "N en curso" and › on the right, one
  line) and three 44 px buttons: **+ Operación**, **Editar**, **Eliminar**.
- AC 8. WHEN the operator taps Ver operaciones THEN a full-screen panel ("Operaciones · esquema N", ✕)
  lists the scheme's operations in the Positions card format: a summary with the labels Posición /
  Entrada / R over the values (R at 28 px); a tap expands it (blue left border) into one row per field
  (Lotes, Cierre, SL, Pips, €, Saldo, Apertura, Cierre, Ticket, Nota); a left swipe reveals **Editar**
  (orange) and **Eliminar** (red) over the R column; a 48 px orange **+ Nueva operación** sits at the
  bottom. Editar opens the existing operation panel, Eliminar the existing confirmation.
- AC 9. WHEN the pagination shows on a phone THEN it is ‹ and › 44 px buttons at both ends with
  "page / pages · N por pág." in the middle; desktop keeps the range text and adds ‹ › compact buttons.
- AC 10. WHEN an operation or scheme is created, edited or deleted from any of these places THEN the list,
  the totals and the open panel refresh as they do today.

## Out of scope

- The data model, the R / balance rules and the `/book` API.
- Translating the page to English.
- The scheme and operation edit panels themselves (they keep their fields and layout).
