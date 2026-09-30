# 001 — Eliminar el motor de trading y el backtest · Diseño

## Enfoque

Eliminar los subsistemas de motor y backtest capa por capa, manteniendo la compilación en verde tras cada commit. Los cuatro módulos de los que dependen otras funcionalidades se mueven primero a una carpeta neutra, `backend/src/indicators/`, para poder borrar después el directorio `engine/` completo. En el frontend se sigue el mismo patrón: se extrae el código exclusivo del backtest del componente de gráfico compartido antes de borrar las carpetas de la funcionalidad, de modo que la página del gráfico se verifica de forma aislada. La base de datos se toca al final, en su propio commit, con una única migración hacia adelante que elimina las cuatro tablas.

Secuencia: código backend → código frontend → base de datos. El backend se despliega primero; el frontend se despliega cuando el usuario lo pida (regla del proyecto). Entre ambos despliegues la app sigue funcionando porque las entradas de menú Backtest y Engine ya están desactivadas, así que ningún cliente llama a `/strategies`.

**Alternativas descartadas**

- *Solo feature flag* (`FEATURE_ENGINE=false` + `FEATURE_BACKTEST`): riesgo cero pero deja ~3.900 líneas muertas y cuatro tablas. Descartada porque el usuario quiere el borrado total.
- *Borrar código, conservar tablas*: evita una migración destructiva pero deja el esquema Prisma y la base de datos con modelos sin uso. Descartada por el mismo motivo. Sigue siendo el punto de parada natural si se pospone el paso de la migración.
- *Mover los módulos compartidos a `backend/src/shared/`*: los cuatro archivos son utilidades de análisis de mercado (EMA, cruce de EMA, tamaño de pip, timeframe), así que un nombre descriptivo (`indicators/`) es más claro que uno genérico.

## Archivos afectados

### Backend — mover (conservar, reubicar)

| Desde | Hasta |
|---|---|
| `backend/src/engine/indicators/ema.ts` | `backend/src/indicators/ema.ts` |
| `backend/src/engine/evaluators/ema-cross.ts` | `backend/src/indicators/ema-cross.ts` (su propio import pasa a ser `./ema`) |
| `backend/src/engine/pip-size.ts` | `backend/src/indicators/pip-size.ts` |
| `backend/src/engine/timeframe.ts` | `backend/src/indicators/timeframe.ts` |

Puntos de import a actualizar (solo ruta, sin cambio de lógica):

- `backend/src/alerts/ema-alert-evaluator.ts` líneas 4–5
- `backend/src/services/scanner.ts` líneas 2–5
- `backend/src/routes/candles.ts` línea 3 (quitar también el comentario de la línea 7 que menciona el backtest)
- `backend/src/routes/setup-levels.ts` líneas 3–5

### Backend — borrar

- `backend/src/engine/engine.ts`
- `backend/src/engine/candle-tracker.ts`
- `backend/src/engine/strategy-evaluator.ts`
- `backend/src/engine/order-executor.ts`
- `backend/src/engine/evaluators/setup-evaluator.ts`
- `backend/src/engine/evaluators/entry-evaluator.ts`
- `backend/src/engine/evaluators/entry/` (activation, scan, sl, trail, exit, sizing)
- `backend/src/services/backtest.ts`
- `backend/src/routes/strategies.ts`

### Backend — modificar

- `backend/src/index.ts`: quitar el import de `Engine` (línea 18), la construcción de `engine` (línea 30) y la llamada `engine?.processTicks(batch)` (línea 39).
- `backend/src/config.ts`: quitar la entrada `engine: flag('FEATURE_ENGINE')` (línea 34).
- `backend/src/app.ts`: quitar el import de `strategiesRouter` (línea 10) y su montaje (línea 44).
- `backend/prisma/schema.prisma`: quitar los modelos `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade` (líneas 48–120).

### Backend — crear

- `backend/prisma/migrations/20260910000000_drop_engine_backtest_tables/migration.sql`

### Frontend — borrar

- `frontend/src/features/backtest/` (carpeta completa: página, paneles, editores, hooks, tipos, defaults, estilos)
- `frontend/src/features/engine/` (página placeholder)

### Frontend — modificar

- `frontend/src/app/Router.tsx`: quitar los imports (líneas 8–9) y las rutas `/backtest`, `/engine` (líneas 29–30).
- `frontend/src/app/layout/AppLayout.tsx`: quitar `IconBacktest` e `IconEngine` del import (línea 4), las dos entradas de menú desactivadas y el comentario que las precede (líneas 14–16). Si `disabled` deja de usarse en alguna entrada, eliminar también su tratamiento en el render.
- `frontend/src/shared/ui/icons.tsx`: quitar `IconBacktest` e `IconEngine`.
- `frontend/src/features/chart/LightweightChart.tsx`: ver más abajo.

## Extracción en LightweightChart

El componente se comparte con la página del gráfico en vivo, así que los cambios se limitan a eliminar las rutas de código que solo ejercitaba el `BacktestChart` borrado. Dos grupos:

**Grupo A — overlay del backtest (exigido por el criterio de aceptación 10)**

- Tipos exportados `BacktestOverlayLevels`, `BacktestOverlayTrade`, `BacktestOverlaySetup`, `BacktestOverlayLayers`, `BacktestOverlay` (líneas 177–220).
- Prop `backtestOverlay` (líneas 223, 249) y `backtestOverlayRef` con su efecto de sincronización (líneas 260–264).
- Callback `drawBacktestOverlay` (líneas 467–680) y su llamada dentro del repintado del canvas (línea 906) más la entrada de dependencias (línea 908).
- El vigilante de escala por frame (líneas 1130–1144) existe solo para repintar el overlay al reescalar verticalmente. Eliminar el bucle `requestAnimationFrame` completo y su cancelación en la limpieza.
- Comentario de las líneas 1382–1383 y `backtestOverlay` en el array de dependencias de la línea 1395.

**Grupo B — props del gráfico exclusivas del backtest (recomendado, mismo commit)**

Estas props solo las pasa `BacktestChart.tsx` y quedan muertas al borrarlo: `focusRange`, `candlesKind`, `emaData`, `onLoadNewer`, `hasNewer`. Al quitarlas se elimina la rama de EMAs del backend en `syncEmaSeries` (líneas 945–967), la lógica `applyFocus` / `pendingFocusRef`, el disparador `onLoadNewer` en el manejador de rango visible (líneas 1105–1107) y el reanclaje de ventana por `candlesKind` en el efecto de velas (líneas 1166–1237). El gráfico en vivo solo usa la heurística de prepend con `candlesKind === undefined`, que debe conservarse como único comportamiento.

El Grupo B es una edición mayor dentro de un componente de 1.400 líneas. Se incluye porque dejar cinco props sin uso en un componente compartido contradice el objetivo de la spec, pero se redacta como tarea propia para poder descartarla o posponerla sin afectar al resto.

## Protocolo de seguridad del gráfico

No romper el gráfico en vivo es la máxima prioridad de esta spec. Estas reglas aplican a cada edición de `LightweightChart.tsx`:

1. **Solo borrado.** No se reescribe, reordena ni "simplifica" ninguna ruta de código que use el gráfico en vivo. Cada bloque eliminado debe ser alcanzable solo cuando se pasa una prop exclusiva del backtest. Si un bloque mezcla lógica en vivo y de backtest, se elimina únicamente la rama de backtest y la rama en vivo queda idéntica byte a byte.
2. **Demostrar que la prop está muerta antes de quitarla.** Antes de tocar una prop, buscar su nombre en todo el frontend; debe aparecer solo en `LightweightChart.tsx` y en `features/backtest/`. `ChartPage.tsx` nunca debe pasarla.
3. **Dos commits separados.** El Grupo A (overlay) y el Grupo B (props de ventana) se commitean por separado para que cualquiera de los dos pueda revertirse solo con `git revert`.
4. **Verificación manual tras cada commit**, en la página Chart, con un broker real y al menos dos timeframes:
   - las velas se renderizan y la vela en vivo se actualiza con los ticks
   - las EMAs de `/chart-indicators` se renderizan y siguen a la vela en vivo
   - al desplazar a la izquierda se cargan velas antiguas y la vista no salta
   - los marcadores de cambio de mes siguen dibujándose
   - los dibujos (líneas de tendencia) se pueden crear, mover y persisten tras recargar
   - las posiciones abiertas muestran líneas de entrada/SL/TP, las etiquetas se recolocan al desplazar y SL/TP se pueden arrastrar
   - los marcadores de alertas de precio se muestran y el diálogo de alerta se abre
   - el panel de nueva operación se abre desde el gráfico y los niveles del setup cargan
   - al redimensionar la ventana se redibuja correctamente
   - sin errores en la consola del navegador
5. **Regla de parada.** Si cualquier punto anterior falla o se comporta distinto y la causa no es evidente en la misma sesión, se revierte el commit y la spec continúa sin ese grupo. El Grupo B es opcional; el Grupo A es obligatorio pero puede reducirse al mínimo (tipos, prop, `drawBacktestOverlay` y su llamada) si la eliminación del vigilante por frame resulta arriesgada.
6. **Puerta de compilación.** `npm run build` (no solo `tsc --noEmit`) debe pasar antes de cada commit.

## Modelo de datos / API

**Modelos Prisma eliminados:** `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade`. Ningún otro modelo los referencia. `SettingsMirror` se conserva.

**Migración** `20260910000000_drop_engine_backtest_tables/migration.sql`, escrita a mano al estilo de la migración existente `drop_positions_table`:

```sql
DROP TABLE IF EXISTS "backtest_trades";
DROP TABLE IF EXISTS "backtest_setups";
DROP TABLE IF EXISTS "backtest_runs";
DROP TABLE IF EXISTS "strategies";
```

El orden sigue las claves foráneas (trade → setup → run → strategy). Las secuencias asociadas a las columnas `id` se eliminan automáticamente con sus tablas. No se modifican las carpetas de migraciones existentes.

**Endpoints eliminados:** todo lo que cuelga de `/strategies` (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /preview`, `GET /:id/backtest`). Ningún otro endpoint cambia.

**Variables de entorno eliminadas:** `FEATURE_ENGINE`. Si está definida en el `.env` del VPS pasa a ser una variable desconocida e inofensiva; no requiere acción.

## Componentes

No hay componentes React nuevos. `LightweightChart` pierde props según lo descrito; el resto de sus props públicas no cambia.

## Riesgos

- **Regresión en el gráfico en vivo.** `LightweightChart.tsx` es el único archivo compartido que se edita en profundidad. Mitigación: el protocolo de seguridad del gráfico descrito arriba (solo borrado, prueba de prop muerta, commits separados, lista de verificación manual, regla de parada).
- **Borrado irreversible.** `prisma migrate deploy` se ejecuta sin supervisión en cada despliegue del backend, así que subir el commit de la migración elimina las tablas en producción sin paso de confirmación. Mitigación: la migración es el último commit de la spec y se sube solo tras confirmación del usuario; las tablas contienen solo datos de prueba (la copia de seguridad queda fuera de alcance).
- **Orden de despliegue.** El backend se despliega al hacer push a `master` tocando `backend/**`; el frontend solo cuando el usuario lo pide. Entre ambos, el paquete antiguo del frontend aún contiene la página Backtest pero no puede llegar a ella (menú desactivado). No se espera rotura.
- **Desfase del cliente Prisma.** Al quitar los modelos desaparecen los accesores `db.strategy` y `db.backtest*` del cliente generado. Todos sus puntos de uso están en archivos que esta spec borra, verificado con grep; la compilación detectará cualquier olvido.
- **`.claude/CLAUDE.md`** sigue describiendo el motor y el JSON de estrategias. Fuera de alcance; un commit `docs:` posterior puede recortarlo.
