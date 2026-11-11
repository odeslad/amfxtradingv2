# 042 — Limitación del repintado del chart · Diseño

> Status: **approved**

## Enfoque

Tres cambios dentro de `features/chart`, todos con la misma idea: **pintar por eventos, nunca por temporizador**.

1. **Coalescencia de ticks** en `LightweightChart.updateLive`: el tick se guarda como pendiente y lo aplica un único planificador que corre como máximo una vez por frame de animación y no más a menudo que cada 250 ms. Gana el último tick.
2. **Hook de cambio de escala en lugar de sondeo**: los bucles de 60 fps de `LightweightChart` y `DrawingTools` se sustituyen por una función, `afterScaleChange()`, llamada desde los sitios donde la escala de precio puede moverse de verdad: tras aplicar un tick, en `visibleLogicalRangeChange`, al redimensionar y en la interacción con puntero / rueda sobre el panel (arrastrar la escala de precio no tiene evento en lightweight-charts). Ejecuta las mismas comparaciones de firmas que hoy hacen los bucles, así que etiquetas, marcadores de alertas y dibujos se mueven exactamente cuando se movían antes.
3. **Overlay más barato**: `drawRollovers` construye una vez por repintado un array ordenado de tiempos de velas de día laborable y ajusta cada línea por búsqueda binaria; los marcadores de alertas y los trades de cruce de EMA se pintan en la misma pasada que hoy.

Más **control por visibilidad**: mientras `document.hidden`, los ticks pendientes se conservan pero no se programa nada; en `visibilitychange` a visible se aplica el tick pendiente.

Sin cambio visual: esta spec no lleva maqueta.

## Cambios en `LightweightChart.tsx`

**Planificador (nuevo, dentro del componente)**
```ts
const pendingRef = useRef<{ candle: Candle; ask?: number } | null>(null);
const lastApplyRef = useRef(0);          // performance.now() de la última aplicación
const applyTimerRef = useRef<number | null>(null);   // id de rAF o de setTimeout
const LIVE_MIN_INTERVAL_MS = 250;
```
- `updateLive(candle, ask)`: `null` resetea como hoy (de inmediato). Si no, `quoteRef` se actualiza al momento (las líneas de spread lo leen cuando repintan) y el tick va a `pendingRef`; `scheduleApply()`.
- `scheduleApply()`: no hace nada si ya hay temporizador o `document.hidden`. Si `now - lastApply >= 250` → `requestAnimationFrame(applyPending)`; si no, `setTimeout(() => requestAnimationFrame(applyPending), restante)`.
- `applyPending()`: limpia el temporizador, toma el tick pendiente, ejecuta el cuerpo actual de `updateLive` (`series.update` de la vela, `updateLiveEmas`, `syncSpreadLines` si el spread está activo), fija `lastApply` y llama a `afterScaleChange()`.
- Listener de `visibilitychange`: al volver a visible, `scheduleApply()` si hay algo pendiente.
- Desmontaje: cancelar el temporizador.

**`afterScaleChange()`** (sustituye al bucle de las líneas 402-435)
- Las mismas dos comprobaciones de firma (Y de etiquetas de posición → `repositionLabels`; Y de marcadores de alertas + id seleccionado → `drawRollovers`), con `lastSig` / `lastAlertSig` en refs.
- Después `trendlineManagerRef.current?.onScaleChange()` (abajo).
- Se llama desde: `applyPending`; `subscribeVisibleLogicalRangeChange` (junto al `drawRollovers` existente, que ahora absorbe: el handler de rango llama a `drawRollovers` incondicionalmente hoy porque cambian las X; se mantiene y `afterScaleChange` omite su propio repintado cuando la firma de alertas no cambió); `ResizeObserver`; y un listener pasivo de `pointermove` (solo con botón pulsado) / `pointerup` / `wheel` sobre el contenedor que programa un único `afterScaleChange` en el siguiente frame (coalescido con un solo id de rAF). También desde los efectos que cambian `positionLevelsRef` y `alertsRef` (ya llaman a `repositionLabels` / `drawRollovers`; reinician las firmas).

**`drawRollovers`**
- `const weekdayTimes = data.filter(c => !isWeekend(c.time)).map(c => c.time)` una vez; `snapToCandle` pasa a ser una búsqueda binaria de cota inferior sobre él. El filtrado de fines de semana y la semántica de "ajustar hacia delante" no cambian. Los cálculos de rollover y de inicio de mes se quedan como están (son baratos comparados con el recorrido).

## Cambios en `DrawingTools.ts`

- `scheduleRaf()` y `rafId` desaparecen. Nuevo método público `onScaleChange()`: calcula la Y del ancla como hace `safeCoord()` y llama a `redraw()` solo si se movió más de 0,5 px (mismo umbral), guardando `lastY` como campo. El constructor y cada antiguo punto de llamada a `scheduleRaf()` (tras añadir / quitar / cargar dibujos y la regla) ahora solo reinician `lastY` para que el siguiente `onScaleChange` repinte.
- `destroy()` ya no cancela ningún frame.

## Cuentas de frecuencia

Hoy, por chart con 3 EMAs: 10 ticks/s × (1 vela + 3 actualizaciones de EMA) = 40 repintados/s de lightweight-charts, más hasta 10 repintados/s del overlay por el bucle, más 60 pasadas de firma/s. Después: ≤ 4 aplicaciones/s → ≤ 16 repintados/s de lightweight-charts (la librería agrupa las actualizaciones emitidas en la misma tarea, así que probablemente 4), repintados del overlay solo cuando un marcador de alerta se mueve un píxel entero, cero trabajo en reposo.

## Ficheros a tocar

| Capa | Fichero | Cambio |
|---|---|---|
| frontend | `src/features/chart/LightweightChart.tsx` | planificador, `afterScaleChange`, listeners, snap por búsqueda binaria |
| frontend | `src/features/chart/DrawingTools.ts` | `onScaleChange()` sustituye al bucle rAF |

Sin dependencias nuevas, sin cambio de backend.

## Verificación

- Build + eslint por tarea.
- **Perfil**: la misma grabación de 10 s en reposo en producción (DevTools > Performance, página del chart, un par, 3 EMAs, algunas alertas y dibujos en pantalla) antes/después; el self time de Paint y "Animation frame fired" en Bottom-up va a `verification.md` (AC 7: cada uno por debajo de un tercio de 3 937 ms / 3 164 ms).
- **Comprobación en reposo** (AC 2): sin ticks (fin de semana o `FEATURE_WS_BROADCAST` apagado en local) la pestaña Performance no muestra actividad periódica de la página.
- **Comportamiento manual** (AC 1, 3-6): vela viva y EMAs se mueven; panel de alertas, etiquetas de posición, marcadores de alertas, dibujos y regla siguen a la escala con scroll / zoom / arrastre del eje de precio / redimensionado; las líneas de spread siguen a la cotización; pestaña oculta → nada; pestaña visible → el chart se pone al día en 250 ms; vista dividida.

## Riesgos

- **Arrastre de la escala de precio sin evento**: cubierto por los listeners de puntero / rueda; si algún caso se escapa (teclado, autoescala programática tras doble clic en el eje) el siguiente tick lo corrige en 250 ms. `fitPrice` (handler del doble clic) llama a `afterScaleChange` explícitamente.
- **Latencia percibida**: un tick puede esperar hasta 250 ms antes de pintarse. En M5 y superiores es invisible; el precio del panel de alertas (`ChartPage`) no se limita, viene directo del handler del WebSocket como hoy.
- **Líneas de spread**: son price lines de la serie y repintan con la vela; sacarlas del planificador reintroduciría repintados, así que van con la misma cadencia de 250 ms.

## Alternativas consideradas

- **Limitar en `ChartSlot` antes de llamar a `updateLive`**: más simple, pero las comprobaciones de firma y los dibujos seguirían necesitando el hook de escala, y el chart no sabría cuándo se aplicó un tick. Rechazada: el planificador pertenece al chart.
- **Mantener el bucle pero a 10 fps**: recorta el coste en reposo 6 veces pero no a cero, y sigue repintando el overlay en cada tick. Rechazada.
- **Quitar el repintado del overlay de marcadores dibujándolos con primitivas de lightweight-charts**: más limpio a largo plazo, cambio mayor, riesgo visual. Fuera de alcance.
