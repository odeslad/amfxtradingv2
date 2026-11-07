# 038 — Regla de pips redimensionable · Diseño

## Enfoque

La regla sigue fuera de la lista `drawings` (nunca se persiste, nunca se cuenta) pero pasa a ser un objeto seleccionable de pleno derecho dentro de `DrawingManager`: los cuatro campos sueltos `rulerStart` / `rulerEnd` / `rulerFixed` / `isRulerMode` se sustituyen por un `ruler: TwoAnchor | null` (`logical1/price1/logical2/price2`, la misma forma que una línea de tendencia) más el flag `isRulerMode` existente para la fase de medición. La selección reutiliza `selectedId` con el id reservado `'ruler'`, así `deleteSelected`, `setLocked`, el botón Delete y `hasSelection` funcionan sin un estado paralelo. Hit test, arrastre y el pulsar-arrastrar-soltar táctil vienen de las rutas de dos anclas de la spec 037, tratando la regla como un candidato más antes del bucle de dibujos.

## Alternativas

- **Hacer la regla un `kind` de `drawings`** y filtrarla en `getPersisted` / `notifyCount`: el mínimo código nuevo, pero todos los consumidores de `drawings` (ancla del RAF, borrar todo, contador, snapshot de persistencia en `setCandleIndex`) necesitan una excepción, y un cambio de timeframe intentaría reanclarla por tiempo. Descartado: un campo aparte es más fácil de razonar y encaja con "efímera".
- **Mantenerla efímera y no seleccionable pero permitir un tercer clic para re-medir**: sin código de arrastre, pero no cumple el AC 2. Descartado.

## Cambios por capa

### frontend

**`features/chart/DrawingTools.ts`**
- Estado: `private ruler: TwoAnchor | null = null` (`type TwoAnchor = { logical1; price1; logical2; price2 }`); `isRulerMode` se mantiene; `rulerStart` / `rulerEnd` / `rulerFixed` desaparecen. `const RULER_ID = 'ruler'`.
- **Medición** (`handleDown`, rama de la regla): primer clic → `drawStart` + preview (como las herramientas de dos anclas, de modo que aplica el pulsar-arrastrar-soltar táctil de la 037: `commitSecondAnchor` gana una rama para la regla); segundo clic → `ruler = {…}`, `isRulerMode = false`, `setSelected(RULER_ID)`, `onDone`. Medir de nuevo sustituye `ruler`.
- **Hit test**: antes del bucle de dibujos, si existe `ruler`: handles (`start` / `end`), luego la diagonal (`distToSegment`) y los bordes / interior de la caja (`onRectEdge` o dentro del rectángulo) → `line` (cuerpo). Devuelve `{ id: RULER_ID, handle }`.
- **Arrastre** (`handleMove`): la rama `selectedId === RULER_ID` actúa sobre `ruler` en vez de sobre un dibujo: `start` / `end` mueven un ancla, `line` desplaza las dos por el delta. Ctrl + arrastrar para duplicar se omite para la regla (fuera de alcance); `handleDoubleAt` la ignora.
- **Selección / eliminación**: `setSelected(null)` en un clic en vacío mantiene la regla en pantalla (AC 3). `deleteSelected` elimina `ruler` cuando es la selección. `clearAll` y `startDrawing` (elegir cualquier herramienta de dibujo) también limpian la regla. `onKeyDown`: Escape limpia la regla (midiendo o no); Supr / Retroceso pasan por `deleteSelected`. `setLocked(true)` deselecciona pero la conserva (AC 4).
- **Reinicio al cambiar de dataset**: `loadPersisted` (se llama al cambiar timeframe / símbolo / broker y al recargar) limpia `ruler`; `setCandleIndex` no la toca (mismo chart, más historial).
- **Pintado**: `paintRuler` pinta desde `ruler` (o desde `drawStart` + cursor durante la preview, misma ruta), y después handles en ambos extremos cuando `selectedId === RULER_ID` (naranja) o durante la preview (gris).
- **Contadores**: `notifyCount` sigue contando solo `drawings.length` (AC 6); `scheduleRaf` mantiene la regla entre sus condiciones de "algo que repintar", con `ruler.price1` como precio ancla cuando no hay dibujos.
- API pública sin cambios: `startRuler`, `stopDrawing`, `deleteSelected`, `clearAll`, `hasSelection`.

**`features/chart/LightweightChart.tsx`** · sin cambios: el botón Delete ya llama a `deleteSelected` y aparece con `hasSelection`; `clearAll` ya lo limpia todo.

## Flujo de datos

Solo frontend, en memoria. La regla nunca llega a `/drawings`.

## Riesgos

- **Prioridad del hit test**: una regla dibujada sobre un rectángulo comparte píxeles con él; la regla se comprueba primero para que una medición seleccionada siempre se pueda agarrar. Aceptable: es temporal.
- **Cambio de timeframe**: hoy la regla sobrevive al cambio en espacio lógico (posiciones erróneas); limpiarla en `loadPersisted` es un cambio de comportamiento que los requisitos piden (AC 3).

## Maqueta

Aprobada por el usuario el 2026-11-07: https://claude.ai/artifact/YZMvnWN3piRDRropW9mtiQ

Artboards:
- Desktop · regla medida y seleccionada — caja verde, diagonal, etiqueta `pips · bars · %`, handle naranja en cada extremo; herramienta Ruler activa en la toolbar.
- Mobile · regla seleccionada tras pulsar-arrastrar-soltar.
