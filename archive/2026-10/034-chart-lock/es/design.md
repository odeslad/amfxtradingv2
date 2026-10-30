# 034 — Candado del gráfico · Diseño

## Enfoque
Un único booleano `locked` en `ChartPage`, guardado en `localStorage` (`chart.locked`), que se pasa a la barra (botón) y a `LightweightChart`, que a su vez lo pasa a `DrawingTools`. Cada manejador de puntero que hoy captura dibujos, niveles o alertas mira primero el flag y deja pasar el evento a lightweight-charts, que mantiene el zoom / desplazamiento de siempre. No se oculta nada ni cambia nada en el backend.

## Cambios en frontend

### `ChartPage.tsx`
- `const [locked, setLocked] = useLocalStorage('chart.locked', false)` — el hook existente que ya se usa para `chart.selection`.
- `toggleLock` lo alterna; `toggleDrawMode` pone `locked` a `false` antes de entrar en una herramienta (AC 6).
- Pasa `locked` / `onToggleLock` a `ChartToolbar` y `locked` a `LightweightChart`.

### `ChartToolbar.tsx` + `shared/ui/icons.tsx`
- Nuevos `IconLock` / `IconUnlock` (mismo trazo de 16px que el resto de iconos).
- Nuevo botón de icono justo después de la campana de alertas, `iconBtnActive` cuando está bloqueado; `title` / `aria-label` "Lock drawings, positions and alerts" / "Unlock …". En móvil queda en la fila principal (no dentro de Draw).

### `LightweightChart.tsx`
- Nueva prop `locked`, reflejada en `lockedRef` (declarada antes de los efectos, como en la spec 032).
- Arrastre de SL/TP/alertas (`startDrag`): con candado devuelve `false` sin seleccionar, para que el evento llegue al gráfico (AC 3, AC 4). Al activar el candado se limpia `selectedLevel` y se termina cualquier arrastre en curso.
- Etiquetas de posición (etiquetas HTML de entrada / SL / TP): con candado llevan la clase `.positionLabelLocked` con `pointer-events: none` — sin edición por doble clic, sin botón ✕ de cierre (oculto), y el gesto pasa al gráfico.
- Llama a `drawingTools.setLocked(locked)` cuando cambia la prop.

### `DrawingTools.ts`
- `private locked = false;` más `setLocked(value)`: lo guarda, deselecciona el dibujo actual, cierra el input de texto y repinta.
- Paso 2 de `handleDown` (hit-test / seleccionar / arrastrar / duplicar con Ctrl): se salta con candado (`return false`) — el modo dibujo y la regla no se ven afectados porque la página quita el candado antes de entrar en ellos (AC 6).
- `onDblClick` (editar texto) y `onKeyDown` Supr / Retroceso: no hacen nada con candado (AC 7).

### Estilos
- `LightweightChart.module.css`: `.positionLabelLocked { pointer-events: none; }` y botón de cierre oculto dentro.
- Sin tokens nuevos: el botón reutiliza `iconBtn` / `iconBtnActive`.

## Flujo de datos
`localStorage` ↔ `ChartPage.locked` → `ChartToolbar` (botón) · `LightweightChart` (`lockedRef`) → `DrawingTools.setLocked`.

## Alternativas consideradas
- **Desactivar `pointer-events` en una capa overlay completa**: más simple, pero los dibujos y los niveles se pintan en el propio canvas del gráfico y sus hit-tests corren en listeners a nivel de documento, así que un cambio CSS no los cubriría.
- **Guardar en Settings (BD)**: sincroniza dispositivos, pero exige migración y cambios en backend; descartado por el usuario (solo navegador).

## Riesgos
- Un arrastre en curso al pulsar el candado: se resuelve terminándolo (`endDrag(false)`), el nivel vuelve a su precio inicial.
- Alertas de la spec 028: el arrastre de alertas usa el mismo `startDrag`, así que una sola guarda cubre ambos.

## Maqueta
Aprobada: https://claude.ai/artifact/9DFF5pZe396vZDrLefrwHE

Artboards: Escritorio · candado desactivado · Escritorio · candado activado · Móvil · candado desactivado · Móvil · candado activado.

Desviación acordada durante la validación: en móvil el candado empujaba Draw a una segunda fila, así que el botón de Indicadores pasó a la fila de Draw (solo móvil; escritorio sin cambios).
