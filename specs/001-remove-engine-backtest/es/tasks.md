# 001 — Eliminar el motor de trading y el backtest · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar y funcionar tras cada tarea. Las tareas de backend (1–4) y de frontend (5–8) nunca comparten commit. La tarea 9 es la única que toca la base de datos y solo se sube tras confirmación explícita del usuario.

## Backend

- [x] 1. Mover los módulos compartidos a `backend/src/indicators/` (`ema.ts`, `ema-cross.ts`, `pip-size.ts`, `timeframe.ts`) y actualizar los imports en `alerts/ema-alert-evaluator.ts`, `services/scanner.ts`, `routes/candles.ts`, `routes/setup-levels.ts` y los temporales en `services/backtest.ts` y `engine/evaluators/*`. Sin cambios de lógica. `npm run build` pasa. — Diseño § Backend — mover. `refactor(backend): move shared indicators out of engine` [SP: 2]

- [x] 2. Eliminar el motor en vivo: borrar `engine/engine.ts`, `engine/candle-tracker.ts`, `engine/strategy-evaluator.ts`, `engine/order-executor.ts`; quitar el import, la construcción y la llamada `processTicks` de `Engine` en `index.ts`; quitar el flag `engine` de `config.ts`. `npm run build` pasa. — Diseño § Backend — borrar / modificar. `refactor(backend): remove trading engine` [SP: 1]

- [x] 3. Eliminar el backtest: borrar `services/backtest.ts`, `routes/strategies.ts`, `engine/evaluators/setup-evaluator.ts`, `engine/evaluators/entry-evaluator.ts`, `engine/evaluators/entry/`; quitar el import y el montaje de `strategiesRouter` en `app.ts`; borrar el directorio `backend/src/engine/` ya vacío. Un grep confirma que no queda ninguna referencia a `engine/`, `db.strategy` ni `db.backtest`. `npm run build` pasa. — Diseño § Backend — borrar / modificar. `refactor(backend): remove backtest service and strategies route` [SP: 2]

- [x] 4. Verificar en el VPS tras el despliegue del backend: `/health` responde, `/strategies` responde 404, la página Scanner carga, se puede crear una alerta de cruce EMA, `/setup-levels` devuelve niveles desde el panel de nueva operación, el log de arranque no muestra `engine` en la línea de features desactivadas. Sin commit; registrar el resultado en Outcome. — Requisitos CA 1, 2, 5. [SP: 1]

## Frontend

- [x] 5. Eliminar el overlay del backtest de `LightweightChart.tsx` (Grupo A): los cinco tipos `BacktestOverlay*`, la prop y el ref `backtestOverlay`, `drawBacktestOverlay` y su llamada, el vigilante de escala por frame, las entradas de dependencias y el comentario obsoleto. Seguir el protocolo de seguridad del gráfico: solo borrado, `npm run build`, y después la lista de verificación manual completa en la página Chart antes de commitear. — Diseño § Extracción en LightweightChart, Grupo A; § Protocolo de seguridad del gráfico. `refactor(frontend): drop backtest overlay from chart component` [SP: 3]

- [x] 6. (Opcional, reversible por separado) Eliminar las props de ventana exclusivas del backtest de `LightweightChart.tsx` (Grupo B): `focusRange`, `candlesKind`, `emaData`, `onLoadNewer`, `hasNewer` y las ramas que solo ellas alcanzan (rama de EMAs del backend en `syncEmaSeries`, `applyFocus` / `pendingFocusRef`, disparador `onLoadNewer`, reanclaje por `candlesKind`). Un grep demuestra que cada prop solo la pasa `features/backtest/`. La ruta de prepend con `candlesKind === undefined` queda byte a byte. `npm run build`, después lista de verificación manual completa. Omitir o revertir según la regla de parada. — Diseño § Grupo B; § Protocolo de seguridad del gráfico. `refactor(frontend): drop backtest-only chart props` [SP: 5]

- [x] 7. Borrar `features/backtest/` y `features/engine/`; quitar sus imports y rutas de `Router.tsx`; quitar `IconBacktest` / `IconEngine` del import de `AppLayout.tsx` y las dos entradas de menú desactivadas (más la rama de render de `disabled` si ninguna entrada la usa ya); borrar ambos iconos de `shared/ui/icons.tsx`. `npm run build` pasa. — Diseño § Frontend — borrar / modificar. `refactor(frontend): remove backtest and engine pages` [SP: 2]

- [x] 8. Verificar en local contra el backend del VPS: login, Journal, Chart (lista de verificación completa una vez más), Scanner y Settings funcionan; consola del navegador limpia. Sin commit; registrar el resultado en Outcome. El frontend se despliega solo cuando el usuario lo pida. — Requisitos CA 10, 11. [SP: 1]

## Base de datos

- [x] 9. Quitar los modelos `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade` de `schema.prisma`, ejecutar `prisma generate`, añadir `prisma/migrations/20260910000000_drop_engine_backtest_tables/migration.sql` con las cuatro sentencias `DROP TABLE IF EXISTS` en orden de claves foráneas. `npm run build` pasa. **Subir solo tras confirmación del usuario**; el despliegue aplica la migración sin supervisión. Después comprobar en el VPS que las cuatro tablas han desaparecido y que `settings_mirror` sigue existiendo. — Diseño § Modelo de datos / API. `chore(db): drop engine and backtest tables` [SP: 2]

## Estimación

Total: 19 SP (14 SP sin la tarea opcional 6).

Referencia: sin specs previas — estimaciones base. Notas de calibración para futuras specs: las tareas 1–3 y 7 son borrados mecánicos con puerta de compilación (1–2 SP); la tarea 5 es una edición quirúrgica en un componente compartido grande con pase de pruebas manual (3 SP); la tarea 6 es lo mismo pero toca la lógica de carga de datos (5 SP).

## Outcome

**Entregado (2026-09-10).** Motor y backtest eliminados de backend, frontend y base de datos en 8 commits (`37cfdfb` → `897b1a7`). Los indicadores compartidos viven en `backend/src/indicators/`. Verificado en producción: `/strategies` 404, scanner / alertas EMA / setup-levels funcionando, cuatro tablas eliminadas (`_prisma_migrations` registra `20260910000000_drop_engine_backtest_tables`), `settings_mirror` intacta, el paquete del frontend desplegado no referencia Backtest.

**Desviaciones acordadas:** la tarea 7 se commiteó antes que la 5 (orden de compilación); la tarea 5 eliminó además el tooltip de entradas del backtest; la tarea 6 reescribió tres líneas (la expresión `preserve` y dos condicionales desenvueltos) en lugar de borrado puro, todas equivalentes para el gráfico en vivo.

**Incidencia:** los deploys de backend y frontend corrieron a la vez tras el push final; el `git pull` del backend abortó sobre un árbol a medio actualizar. Relanzar `deploy.ps1` por SSH lo resolvió. Conviene serializar los dos workflows o hacer tolerante el pull del backend.

**Esfuerzo real:**
- Tarea 1: estimada 2, ajustada.
- Tarea 2: estimada 1, ajustada.
- Tarea 3: estimada 2, pareció 1 — borrado puro, grep limpio a la primera.
- Tarea 4: estimada 1, ajustada; las comprobaciones de UI con sesión las hizo el usuario.
- Tarea 5: estimada 3, pareció 3 — el tooltip no listado añadió algo; el reorden en dos commits costó más que la edición.
- Tarea 6: estimada 5, pareció 3 — una vez probadas muertas las props, las ramas se aislaron fácil.
- Tarea 7: estimada 2, ajustada.
- Tarea 8: estimada 1, ajustada.
- Tarea 9: estimada 2, pareció 3 — DLL de Prisma bloqueada por un proceso local huérfano y la incidencia del deploy concurrente.

### Verificación de la tarea 4 (2026-09-10)

Backend desplegado en `04ed605`, pm2 online con 0 reinicios. Log de arranque: `[FEATURES] Disabled: none`. `/health` 200; `/strategies` y `/strategies/1/backtest` 404; `/scanner`, `/setup-levels`, `/candles/emas`, `/ema-alerts` 401 sin cookie (montadas). El usuario confirmó en producción: la página Scanner carga, se puede crear una alerta de cruce EMA, el panel de nueva operación carga los niveles del setup. Se anotan avisos `EBUSY` del file-watcher preexistentes y sin relación.

### Cambio de orden (2026-09-10)

La tarea 7 se commiteó antes que la 5: `BacktestChart.tsx` es el único consumidor de los tipos `BacktestOverlay*`, así que quitarlos del componente del gráfico no compila mientras existan las páginas del backtest. Cada commit compila por sí solo. La tarea 5 elimina además el tooltip de entradas del backtest (`entryPointsRef`, `entryTip`, su JSX y su CSS), que solo rellena `drawBacktestOverlay` y no estaba listado explícitamente en el diseño.

### Verificación de la tarea 8 (2026-09-10)

Servidor de desarrollo contra el backend de producción. El usuario confirmó: login, Journal, Chart (lista completa tras la tarea 5 y de nuevo tras la 6), Scanner y Settings funcionan; el menú solo muestra Journal, Chart, Scanner y Settings en escritorio y móvil; consola del navegador limpia.
