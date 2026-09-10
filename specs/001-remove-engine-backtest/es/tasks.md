# 001 — Eliminar el motor de trading y el backtest · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar y funcionar tras cada tarea. Las tareas de backend (1–4) y de frontend (5–8) nunca comparten commit. La tarea 9 es la única que toca la base de datos y solo se sube tras confirmación explícita del usuario.

## Backend

- [x] 1. Mover los módulos compartidos a `backend/src/indicators/` (`ema.ts`, `ema-cross.ts`, `pip-size.ts`, `timeframe.ts`) y actualizar los imports en `alerts/ema-alert-evaluator.ts`, `services/scanner.ts`, `routes/candles.ts`, `routes/setup-levels.ts` y los temporales en `services/backtest.ts` y `engine/evaluators/*`. Sin cambios de lógica. `npm run build` pasa. — Diseño § Backend — mover. `refactor(backend): move shared indicators out of engine` [SP: 2]

- [ ] 2. Eliminar el motor en vivo: borrar `engine/engine.ts`, `engine/candle-tracker.ts`, `engine/strategy-evaluator.ts`, `engine/order-executor.ts`; quitar el import, la construcción y la llamada `processTicks` de `Engine` en `index.ts`; quitar el flag `engine` de `config.ts`. `npm run build` pasa. — Diseño § Backend — borrar / modificar. `refactor(backend): remove trading engine` [SP: 1]

- [ ] 3. Eliminar el backtest: borrar `services/backtest.ts`, `routes/strategies.ts`, `engine/evaluators/setup-evaluator.ts`, `engine/evaluators/entry-evaluator.ts`, `engine/evaluators/entry/`; quitar el import y el montaje de `strategiesRouter` en `app.ts`; borrar el directorio `backend/src/engine/` ya vacío. Un grep confirma que no queda ninguna referencia a `engine/`, `db.strategy` ni `db.backtest`. `npm run build` pasa. — Diseño § Backend — borrar / modificar. `refactor(backend): remove backtest service and strategies route` [SP: 2]

- [ ] 4. Verificar en el VPS tras el despliegue del backend: `/health` responde, `/strategies` responde 404, la página Scanner carga, se puede crear una alerta de cruce EMA, `/setup-levels` devuelve niveles desde el panel de nueva operación, el log de arranque no muestra `engine` en la línea de features desactivadas. Sin commit; registrar el resultado en Outcome. — Requisitos CA 1, 2, 5. [SP: 1]

## Frontend

- [ ] 5. Eliminar el overlay del backtest de `LightweightChart.tsx` (Grupo A): los cinco tipos `BacktestOverlay*`, la prop y el ref `backtestOverlay`, `drawBacktestOverlay` y su llamada, el vigilante de escala por frame, las entradas de dependencias y el comentario obsoleto. Seguir el protocolo de seguridad del gráfico: solo borrado, `npm run build`, y después la lista de verificación manual completa en la página Chart antes de commitear. — Diseño § Extracción en LightweightChart, Grupo A; § Protocolo de seguridad del gráfico. `refactor(frontend): drop backtest overlay from chart component` [SP: 3]

- [ ] 6. (Opcional, reversible por separado) Eliminar las props de ventana exclusivas del backtest de `LightweightChart.tsx` (Grupo B): `focusRange`, `candlesKind`, `emaData`, `onLoadNewer`, `hasNewer` y las ramas que solo ellas alcanzan (rama de EMAs del backend en `syncEmaSeries`, `applyFocus` / `pendingFocusRef`, disparador `onLoadNewer`, reanclaje por `candlesKind`). Un grep demuestra que cada prop solo la pasa `features/backtest/`. La ruta de prepend con `candlesKind === undefined` queda byte a byte. `npm run build`, después lista de verificación manual completa. Omitir o revertir según la regla de parada. — Diseño § Grupo B; § Protocolo de seguridad del gráfico. `refactor(frontend): drop backtest-only chart props` [SP: 5]

- [ ] 7. Borrar `features/backtest/` y `features/engine/`; quitar sus imports y rutas de `Router.tsx`; quitar `IconBacktest` / `IconEngine` del import de `AppLayout.tsx` y las dos entradas de menú desactivadas (más la rama de render de `disabled` si ninguna entrada la usa ya); borrar ambos iconos de `shared/ui/icons.tsx`. `npm run build` pasa. — Diseño § Frontend — borrar / modificar. `refactor(frontend): remove backtest and engine pages` [SP: 2]

- [ ] 8. Verificar en local contra el backend del VPS: login, Journal, Chart (lista de verificación completa una vez más), Scanner y Settings funcionan; consola del navegador limpia. Sin commit; registrar el resultado en Outcome. El frontend se despliega solo cuando el usuario lo pida. — Requisitos CA 10, 11. [SP: 1]

## Base de datos

- [ ] 9. Quitar los modelos `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade` de `schema.prisma`, ejecutar `prisma generate`, añadir `prisma/migrations/20260910000000_drop_engine_backtest_tables/migration.sql` con las cuatro sentencias `DROP TABLE IF EXISTS` en orden de claves foráneas. `npm run build` pasa. **Subir solo tras confirmación del usuario**; el despliegue aplica la migración sin supervisión. Después comprobar en el VPS que las cuatro tablas han desaparecido y que `settings_mirror` sigue existiendo. — Diseño § Modelo de datos / API. `chore(db): drop engine and backtest tables` [SP: 2]

## Estimación

Total: 19 SP (14 SP sin la tarea opcional 6).

Referencia: sin specs previas — estimaciones base. Notas de calibración para futuras specs: las tareas 1–3 y 7 son borrados mecánicos con puerta de compilación (1–2 SP); la tarea 5 es una edición quirúrgica en un componente compartido grande con pase de pruebas manual (3 SP); la tarea 6 es lo mismo pero toca la lógica de carga de datos (5 SP).

## Outcome

_(lo rellena /spec-implement)_
