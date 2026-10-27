# 027 — Un único campo de fecha · Diseño

## Enfoque

Un único campo compartido en `src/shared/ui/` con su propio calendario, más helpers puros en
`src/lib/dateField.ts`. Cada formulario conserva la forma de valor que tiene hoy y convierte en su borde, así
que nada de lo que se envía al backend cambia (CA 7). Sin dependencias: el calendario es una rejilla de mes
hecha con React y CSS Modules.

## Helpers puros — `lib/dateField.ts`

```ts
type DateMode = 'date' | 'datetime';
interface DateParts { year: number; month: number; day: number; hour: number; minute: number } // mes 0-11

formatDigits(raw: string, mode, prev?: string): string // conserva dígitos, inserta "/", " ", ":"; borrar un
                                                        // separador se lleva el dígito anterior (CA 2, CA 3)
isComplete(text, mode): boolean                         // 10 o 16 caracteres
parseDisplay(text, mode): DateParts | null              // null si está incompleto o no es fecha / hora real (CA 4)
toDisplay(parts, mode): string                          // "DD/MM/YYYY" o "DD/MM/YYYY HH:MM"
isoDateToDisplay('2026-10-14') → '14/10/2026'           // filtros, inicio / fin del esquema
displayToIsoDate('14/10/2026') → '2026-10-14' | null
```

`formatDigits` se limita a 8 / 12 dígitos y trata el texto pegado igual.

## Componentes — `shared/ui/DateField.tsx` (+ `.module.css`), `shared/ui/Calendar.tsx` (+ `.module.css`)

- **`DateField`** (controlado por el texto mostrado): props `mode`, `value` (texto mostrado),
  `onChange(text)`, `id`, `required`, `invalid?` (rojo forzado), `className` para el estilo de input del
  formulario. Pinta un `<input type="text" inputMode="numeric" placeholder="DD/MM/YYYY[ HH:MM]">`, el botón de
  icono de calendario dentro del campo a la derecha, y el borde rojo cuando `isComplete && !parseDisplay`.
  El tecleo pasa por `formatDigits(e.target.value, mode, value)`.
- **`IsoDateField`**: un envoltorio fino para los campos cuyo valor es `YYYY-MM-DD` (Inicio / Fin del esquema,
  filtros del Journal y de Stats). Guarda el texto mostrado en estado local, emite la fecha ISO cuando el
  texto es una fecha completa válida y `''` al vaciarse, y resincroniza su texto cuando cambia el valor de
  fuera (CA 8).
- **`Calendar`**: rejilla de mes, lunes primero (desplazamiento `(getDay() + 6) % 7`), flechas ‹ › de mes, día
  elegido en naranja, hoy con borde azul, **Hoy**; en modo fecha y hora un campo de hora formateado `HH:MM` con
  la misma regla de dígitos. Elegir un día conserva la hora escrita (o `00:00`); el modo fecha cierra, el modo
  fecha y hora sigue abierto; en el teléfono un botón **Aceptar** lo cierra (CA 6). El mes visible sigue al
  campo cuando se escribe una fecha completa válida.
- **Desplegable de escritorio**: pintado con `createPortal` en `document.body`, `position: fixed`, z-index 60
  (por encima del 50 de los paneles laterales), así el `overflow` de los paneles nunca lo recorta. Posición
  calculada en `useLayoutEffect` a partir del `getBoundingClientRect()` del campo y del tamaño del
  desplegable: alineado a la izquierda por defecto, al borde derecho del campo cuando pasaría de
  `innerWidth − 8`, encima del campo cuando pasaría de `innerHeight − 8`, con 8 px de margen en todos los
  lados (CA 5). Se recalcula con scroll / resize mientras está abierto; se cierra con clic fuera, Escape y al
  perder el foco fuera de él.
- **Teléfono (≤ 768 px)**: el mismo `Calendar` como panel inferior (portal, fijo, ancho completo, fondo
  oscurecido, días de 44 px); `matchMedia('(max-width: 768px)')` decide cuál se abre.

## Formularios

| Sitio | Campo(s) | Valor hoy | Cambio |
|---|---|---|---|
| `book/TradePanel` | Apertura, Cierre | texto mostrado, `parseBookInput` | `DateField mode="datetime"`; `parseBookInput` sin cambios |
| `book/SchemePanel` | Inicio, Fin | `YYYY-MM-DD` | `IsoDateField` |
| `settings/NotificationPanel` | Ends | texto mostrado, `parseLocalInput` local | `DateField mode="datetime"` |
| `journal/FiltersPanel` | From, To | `YYYY-MM-DD` | `IsoDateField` (min / max fuera: el rango se valida al aplicar como hoy) |
| `stats/StatsFilters` | From, To | `YYYY-MM-DD` | `IsoDateField` |

Los toasts de error de cada formulario se quedan como están; `required` mantiene su significado (CA 4).

## Ficheros

```
frontend/src/lib/dateField.ts                                   nuevo
frontend/src/shared/ui/DateField.tsx (+ .module.css)            nuevo
frontend/src/shared/ui/Calendar.tsx (+ .module.css)             nuevo
frontend/src/features/book/TradePanel.tsx, SchemePanel.tsx      edit
frontend/src/features/settings/NotificationPanel.tsx            edit
frontend/src/features/journal/FiltersPanel.tsx                  edit
frontend/src/features/stats/StatsFilters.tsx                    edit
```

## Maqueta

Artefacto Design aprobado por el usuario el 27-10-2026: https://claude.ai/artifact/7rBJBwxgMhLUsRc3h2bh8b.
Mesas: DateField · escritorio (interactiva: dos campos, formato de dígitos en vivo, validación, el desplegable
del calendario abierto con flechas de mes, días elegido / hoy, Hoy y el campo de hora), DateField · móvil
(panel inferior sobre el panel de operación con días de 44 px, campo de hora, Hoy y Aceptar).

## Riesgos

- Los filtros del Journal / Stats pierden el `min` / `max` nativo entre From y To; un rango invertido ya da
  cero filas, y el código de filtros sigue trabajando con las cadenas ISO.
- iOS Safari hace zoom en inputs de menos de 16 px: la fuente del campo en el teléfono se queda en
  `--text-xl` como los demás inputs de los paneles.
