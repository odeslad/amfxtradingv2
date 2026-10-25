# 026 — UX de la página de esquemas · Diseño

## Enfoque

Una reorganización dentro de `features/book/` que reutiliza los dos patrones ya establecidos del Journal en
lugar de inventar otros: las acciones de fila al pasar el ratón de la tabla de Positions (escritorio) y la
card de Positions con acciones al deslizar (móvil). Sin cambios de API, tipos ni cálculos; `useBook`,
`lib/book.ts`, `SchemePanel`, `TradePanel` y `ConfirmPanel` se usan tal cual. Los textos siguen en español.

## Escritorio

### Cabecera y totales (CA 1, CA 2) — `BookPage.tsx` + `.module.css`

- El `<h1>` + `<select>` de año pasan a una barra de pestañas con las clases de pestaña del Journal
  copiadas en `BookPage.module.css` (`.tabBar`, `.tab`, `.tabActive`): una pestaña por `data.years` más
  **Todos**, `selectYear` al hacer clic; **+ Nuevo esquema** va a `.tabBarRight` como `newBtn` verde
  contorneado (estilo de Settings 023).
- Los siete tiles pasan a una `.strip` (flex, separadores con `border-left`): Esquemas con "· N en curso",
  Ganados, Empates, Perdidos, % ganados, y Neto € y Neto R empujados a la derecha (`margin-left: auto`) a
  `--text-2xl`.

### Tablas de esquemas y operaciones (CA 3, CA 4, CA 5) — `SchemesTable.tsx` + `.module.css`

- Columnas de la fila de esquema: chevron, Esq., `Inicio → Fin` (una celda, "en curso" en dorado),
  Operaciones, Resultado, Neto €, Neto R, más una celda de acciones.
- Las acciones de fila son las del Journal: una `actionsCell` (`width: 0; padding: 0`) con `rowActions`
  (absoluto, a la derecha de la fila) y `rowActionsInner` (translateX(100%) → 0 con `:hover`, 0,18 s), con
  `editBtn` (naranja) y `closeBtn` (rojo) rotulados Editar / Eliminar. Las clases se copian en
  `SchemesTable.module.css` con los mismos nombres (sin importar CSS de otra feature), `tbody tr {
  position: relative }`. Los clics en los botones detienen la propagación para no plegar la fila.
- Tabla de operaciones: Pos., Dir., Lotes, Entrada, Cierre (precio), Apertura → Cierre (una celda), Pips,
  €, R, Saldo y la misma celda de acciones; ticket, SL y nota salen de la tabla.
- `.badge` pierde borde, padding y radio: solo texto de color en mayúsculas.

### Paginación (CA 9) — `BookPage.tsx`

El escritorio conserva el texto de rango y el select de tamaño de página; Anterior / Siguiente pasan a
`pageBtn` compactos ‹ ›.

## Móvil

### Totales y cabecera (CA 1, CA 2)

Por debajo de 768 px: pestañas `flex: 1` como en Settings, **+ Nuevo esquema** en una fila de 44 px a
ancho completo; la franja pasa a `.totalsMobile` (línea de título, 2 columnas Neto € 22 px / Neto R 28 px,
4 columnas de recuentos bajo un separador). Se pintan los dos marcados y los alterna el CSS, el patrón que
usa el resto de la app.

### Cards de esquema (CA 6, CA 7) — nuevo `SchemeCard.tsx` (+ `.module.css`)

Extraída de la rama de card actual de `SchemesTable`, que crece demasiado en línea:

- Cerrada: un `<button>` de cabecera (▸ #N, texto del resultado) y una rejilla de 3 columnas con etiqueta
  Inicio / Neto € (15 px) / Neto R (28 px, `--text-3xl`), borde izquierdo del color del resultado.
- Abierta (▾): rejilla Inicio / Fin / Neto € / Neto R; un botón **Ver operaciones** (pastilla con el
  número, "N en curso", ›; `white-space: nowrap`); y tres botones de 44 px + Operación / Editar / Eliminar.
- El estado abierto sigue en `SchemesTable` (`openId`), como hoy.

### Panel de operaciones (CA 8) — nuevos `OperationsPanel.tsx` + `OperationCard.tsx` (+ `.module.css`)

- `OperationsPanel` usa el armazón compartido de los paneles (`journal/BulkEditPanel.module.css`, a ancho
  completo en el móvil como todos) con título "Operaciones · esquema N", la lista y un botón naranja de
  48 px **+ Nueva operación** al pie. Se abre desde `BookPage` (nuevo tipo de `Panel` `operations` con el
  id del esquema) y lee el esquema de `data.schemes` en cada render, así las ediciones y borrados lo
  refrescan (CA 10).
- `OperationCard` calca `PositionCard`: `useSwipeActions` de `journal/utils/useSwipeActions` para el
  deslizamiento y el toque para desplegar; rejilla de resumen con las etiquetas Posición / Entrada / R
  sobre los valores (R a `--text-3xl`, "en curso" en dorado en las abiertas); filas desplegadas Lotes,
  Cierre, SL, Pips, €, Saldo, Apertura, Cierre, Ticket, Nota (filas `space-between`, `--text-xl`); las
  acciones del deslizamiento Editar (naranja) / Eliminar (rojo) abren el `TradePanel` y el `ConfirmPanel`
  existentes a través de los handlers de `BookPage`. Su CSS copia las reglas de card de
  `PositionCard.module.css`.
- Con el panel de operaciones abierto, el panel de operación o la confirmación se apilan encima (ambos son
  paneles `z-index: 50` pintados después en el árbol); al cerrarlos se vuelve a la lista.

### Paginación (CA 9)

Por debajo de 768 px: botones ‹ y › de 44 px en los extremos, "página / páginas · N por pág." centrado; el
select de tamaño de página solo queda en escritorio.

## Ficheros

```
frontend/src/features/book/BookPage.tsx, BookPage.module.css        edit
frontend/src/features/book/SchemesTable.tsx, SchemesTable.module.css edit
frontend/src/features/book/SchemeCard.tsx (+ .module.css)            nuevo
frontend/src/features/book/OperationsPanel.tsx                       nuevo
frontend/src/features/book/OperationCard.tsx (+ .module.css)         nuevo
```

## Maqueta

Artefacto Design aprobado por el usuario el 25-10-2026: https://claude.ai/artifact/MHTftwXsiwx6JLtfbrDPBe.
Mesas: Esquemas · escritorio (barra de pestañas, franja de totales, tabla de esquemas con acciones sobre el
final de la fila al pasar el ratón, operaciones desplegadas en 10 columnas), Esquemas · móvil (pestañas,
botón nuevo a ancho completo, bloque de totales, cards cerradas, paginación), Esquemas · móvil, esquema
abierto (card abierta, Ver operaciones, acciones), Esquemas · móvil, operaciones (panel a pantalla completa
con cards al estilo Positions: cerrada, deslizada, desplegada).

## Riesgos

- Dos paneles apilados en el móvil (panel de operaciones + panel de operación): si el apilado resulta
  incómodo, el panel de operación puede sustituir al de operaciones y reabrirlo al cerrar; se decide
  durante la implementación.
- El select de tamaño de página desaparece en el móvil; conserva el último valor elegido en escritorio
  (guardado como hoy).
