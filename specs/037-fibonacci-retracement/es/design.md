# 037 — Herramienta de retroceso de Fibonacci · Diseño

## Enfoque

Dos partes: el dibujo en sí (solo frontend) y el conjunto de niveles, elegido en Ajustes > Display y guardado con el resto de ajustes de display (db + backend + frontend).

El Fibonacci es un `kind` más en la lista de dibujos de `DrawingManager` (`frontend/src/features/chart/DrawingTools.ts`): un dibujo de dos anclas como la línea de tendencia (`logical1/price1` → `logical2/price2`), persistido como `{ kind: 'fib', time1, price1, time2, price2, color? }` en el mismo array JSON que el backend ya guarda de forma opaca (`PUT /drawings` solo comprueba que `items` sea un array, así que no hay cambio de backend ni de BD ni migración). Todo el comportamiento de dos anclas que ya tiene la línea de tendencia (hit test en los handles y en el segmento, arrastre de un ancla o del dibujo entero, duplicar con Ctrl + arrastre, Delete, bloqueo, ciclo de color con doble clic, persistencia por tiempo) se reutiliza ampliando las ramas `line` a `line | fib`; solo el pintado y la superficie de hit test son nuevos.

Los niveles se calculan al pintar a partir de los dos precios de las anclas: `price = price2 + (price1 − price2) × ratio` para cada ratio activado en Ajustes (por defecto `{0, 0.236, 0.382, 0.5, 0.618, 0.786, 1}`; las extensiones por encima de 1 caen más allá de la primera ancla con la misma fórmula), de modo que el nivel 0 queda en el segundo clic y el 100 en el primero (AC 1) y la dirección del impulso va implícita en el orden de los clics. Cada nivel es un segmento horizontal desde la x del ancla más a la izquierda hasta la x del ancla más a la derecha (AC 2, según la corrección), las anclas se unen con un segmento discontinuo y la etiqueta `61.8  1.08432` va en el extremo izquierdo de cada nivel, encima de la línea.

## Alternativas

- **`FibonacciManager` separado con su propio canvas**: aísla el código nuevo pero duplica selección, arrastre, persistencia, bloqueo y teclado, y necesita un segundo orden z y un segundo payload de `/drawings`. Descartado: la gracia de la spec es que el Fibonacci se comporte exactamente como los demás dibujos.
- **Niveles como price lines de `lightweight-charts`**: etiquetas gratis en el eje de precios, pero las price lines cruzan todo el ancho del chart (contradice AC 2), no se arrastran como un objeto y no viven en la lista de dibujos. Descartado.
- **Niveles guardados por dibujo**: permite que dos Fibonacci difieran, pero cada dibujo existente necesitaría migración y los interruptores de Ajustes no les afectarían. Descartado: el conjunto es global, como la apariencia de la línea de tendencia, y el dibujo guarda solo sus dos anclas.
- **Ratios en texto libre**: más flexible, pero exige UI de validación y reglas de orden. Descartado a favor de un catálogo fijo con interruptores, el patrón que ya usan los Setup levels.

## Cambios por capa

### db

**`backend/prisma/schema.prisma`** · `SettingsDisplay` gana `fibLevels Float[] @default([0, 23.6, 38.2, 50, 61.8, 78.6, 100])` (valores en porcentaje, las claves del catálogo). Migración escrita a mano `20261106000000_fib_levels`:

```sql
ALTER TABLE "settings_display" ADD COLUMN "fibLevels" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[0,23.6,38.2,50,61.8,78.6,100]::DOUBLE PRECISION[];
```

### backend

**`src/routes/settings.ts`** · `FIB_LEVEL_CATALOGUE = [0, 23.6, 38.2, 50, 61.8, 78.6, 100, 127.2, 161.8, 200, 261.8]`; `parseFibLevels` calca `parseSetupLevels`: array de números del catálogo, sin duplicados, orden canónico, `0` y `100` forzados. `DisplayInput` / `DisplayRow` / `toResponse` / upsert ganan `fibLevels`. Los builds antiguos de frontend nunca envían el campo, así que para ellos nada cambia.

### frontend

**`features/chart/DrawingTools.ts`**
- `DrawingKind` gana `'fib'`; nuevas interfaces `FibDrawing` / `PersistedFib` con los campos de la línea de tendencia (`logical1/price1/logical2/price2`, `color` opcional).
- `TrendlineAppearance` gana `fibLevels?: number[]` (valores en porcentaje desde Ajustes; por defecto `[0, 23.6, 38.2, 50, 61.8, 78.6, 100]`), así el conjunto llega a cada `DrawingManager` por el `setAppearance` existente y un cambio en Ajustes redibuja todos los charts. `FIB_KEY_LEVELS = new Set([50, 61.8])`; `FIB_LABEL_FONT = '9px "DM Mono", monospace'` (la fuente de precios del rectángulo) y el `TEXT_COLOR` existente para los niveles clave, texto tipo `--muted` `#8c8c8c` para el resto.
- `segPixels`, `hitTest`, `handleMove` (`start` / `end` / mover), `handleDown` (creación en dos clics y duplicar con Ctrl), `handleDoubleAt` (ciclo de color), `toPersisted`, `applyPersisted`, `loadPersisted`: toda rama `d.kind === 'line'` que trate de dos anclas pasa a `line | fib`. Shift para horizontal sigue siendo solo de la línea de tendencia.
- `hitTest` para `fib`: primero las anclas (handles `start` / `end`), luego el segmento discontinuo entre anclas, luego cada segmento de nivel (`distToSegment` contra el tramo horizontal), todos devolviendo `line` como handle de cuerpo para que aplique el código de mover existente.
- Nuevo `paintFib(d, selected, preview)`: calcula los precios de los niveles, pinta cada nivel como segmento horizontal con el color del dibujo (`d.color ?? appearance.color`), grosor y trazo de `appearance` (AC 7), los niveles 50 % y 61.8 % siempre sólidos, el segmento entre anclas discontinuo `[4, 4]` del mismo color con alfa 0.6, y después las etiquetas (`pct.toFixed(1) + '  ' + price.toFixed(decimals)`, decimales desde `pipSize` como hace `paintRectPrices`) con el contorno negro de las etiquetas del rectángulo; handles en ambas anclas cuando está seleccionado o en preview.
- `redraw`: la rama de preview pinta un `fib` desde `drawStart` hasta el cursor exactamente como la forma definitiva (misma regla que line / rect).
- Precio ancla de `scheduleRaf`: sin cambios (`price1` existe en el fib).

**`features/chart/LightweightChart.tsx`**
- `DrawMode` gana `'fib'`; `drawModeToKind` lo mapea a `{ kind: 'fib' }`.

**`features/chart/ChartToolbar.tsx`**
- `DRAW_TOOLS` gana `{ mode: 'fib', title: 'Fibonacci retracement (two clicks, Ctrl+drag = duplicate, Del = delete)', label: 'Fibonacci', icon: <IconFib size={16} /> }` justo después del rectángulo, así queda en el grupo de escritorio y en la fila Draw de móvil (AC 6) sin más cambios.

**`shared/ui/icons.tsx`**
- `IconFib`: 16 px, mismo trazo 1.2 que `IconTrendline`: tres líneas horizontales de longitud decreciente (`y = 4, 8, 12`) y una diagonal fina de abajo-izquierda a arriba-derecha.

**`features/settings/DisplayTab.tsx`** · `DisplaySettingsForm` gana `fibLevels: number[]`; nuevo grupo "Fibonacci levels" tras "Rectangle labels" (maqueta): un `levelGrid` de `levelCard`, una por entrada del catálogo, etiqueta `61.8 %` y un interruptor; las tarjetas `0` y `100` van activas y deshabilitadas. `SettingsPage.tsx` añade el campo a `DEFAULT_DISPLAY` y al payload de `/settings`; `ChartPage.tsx` lee `display.fibLevels` en `trendlineAppearance`.

**Split view (AC 5)**: cada `ChartSlot` tiene su `DrawingManager`, su `drawMode` y su payload de `/drawings` (spec 036), así que no hay nada que añadir.

**Builds antiguos (AC 4)**: `loadPersisted` en el bundle desplegado solo distingue `marker | symbol | text` frente a "lo demás son dos anclas", así que un item con `kind: 'fib'` se cargaría como dibujo de dos anclas y se pintaría como línea. No rompe; se ve como línea de tendencia hasta que el usuario recarga al build nuevo. Aceptable para un deploy solo de frontend donde los dos builds nunca conviven mucho tiempo.

## Flujo de datos

Dibujo: `DrawingManager.getPersisted()` → `PUT /drawings` con debounce → JSON `Drawing.items` (sin cambios) → `GET /drawings` → `loadPersisted`.

Niveles: Ajustes > Display → `PUT /settings { display: { fibLevels } }` → `settings_display.fibLevels` → `GET /settings` en la página Chart → `trendlineAppearance.fibLevels` → `setAppearance` → `redraw`.

## Riesgos

- **Etiquetas amontonadas en impulsos pequeños**: siete etiquetas en pocos píxeles. Mitigación: cuando dos niveles consecutivos distan menos de 12 px, solo los niveles clave (0, 50, 61.8, 100) conservan etiqueta; las líneas se pintan igual.
- **Hit test de siete segmentos horizontales por Fibonacci** en cada `mousemove`: coste trivial frente al bucle por dibujo existente.
- **El ciclo de `color`** reutiliza la paleta de la línea (por defecto → rojo → verde); los niveles clave mantienen el texto brillante en todos los casos.

## Maqueta

Aprobada por el usuario el 2026-11-06: https://claude.ai/artifact/4wZvwzaDDSCtwAwKnUaywj

Artboards:
- Desktop · Fibonacci dibujado y seleccionado — niveles 0 a 100 entre las dos anclas, 50 % y 61.8 % sólidos con etiqueta brillante, el resto discontinuos en gris; segmento discontinuo entre anclas; handles naranjas; Delete / Clear all; herramienta Fibonacci activa en la toolbar tras el rectángulo.
- Desktop · tras el primer clic — la preview sigue al cursor con handles grises y el crosshair.
- Mobile · fila Draw abierta con la herramienta Fibonacci activa y el mismo dibujo.
- Desktop · Ajustes > Display · grupo Niveles de Fibonacci — once tarjetas de nivel con interruptor, 0 y 100 activos y atenuados, los siete por defecto encendidos.
