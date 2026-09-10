# 001 — Eliminar el motor de trading y el backtest

## Contexto

El motor de trading (`backend/src/engine/`) y el subsistema de backtest (servicio en backend, ruta `/strategies`, página Backtest en frontend, cuatro modelos Prisma) se construyeron durante la Fase 2 pero nunca llegaron a funcionar: el motor en vivo es un esqueleto que no evalúa nada y las entradas de menú Backtest y Engine ya están desactivadas. El código sigue incluido en ambos paquetes, el endpoint `/strategies` sigue expuesto y puede lanzar backtests pesados, y quedan cuatro tablas sin uso en la base de datos. Esta spec lo elimina todo conservando los módulos compartidos de los que dependen otras funcionalidades.

## Historias de usuario

- Como mantenedor, quiero eliminar el código del motor y del backtest del backend y del frontend para que el repositorio solo contenga funcionalidades en uso.
- Como mantenedor, quiero eliminar las cuatro tablas de backtest de la base de datos para que el esquema coincida con la aplicación en ejecución.
- Como usuario de la app, quiero que el gráfico en vivo, el escáner, las alertas de cruce EMA, el diario y los ajustes sigan funcionando exactamente igual, para que la limpieza sea invisible.

## Criterios de aceptación

1. CUANDO arranque el backend ENTONCES el sistema NO DEBERÁ importar, construir ni referenciar la clase `Engine`, y el flag `FEATURE_ENGINE` DEBERÁ desaparecer de `config.ts`.
2. CUANDO un cliente llame a cualquier ruta bajo `/strategies` ENTONCES el backend DEBERÁ responder 404 (ruta no montada).
3. Los siguientes archivos del backend DEBERÁN borrarse: `engine/engine.ts`, `engine/candle-tracker.ts`, `engine/strategy-evaluator.ts`, `engine/order-executor.ts`, `engine/evaluators/setup-evaluator.ts`, `engine/evaluators/entry-evaluator.ts`, `engine/evaluators/entry/*`, `services/backtest.ts`, `routes/strategies.ts`.
4. Los módulos compartidos `indicators/ema.ts`, `pip-size.ts`, `timeframe.ts` y `evaluators/ema-cross.ts` DEBERÁN conservarse, reubicarse fuera de `engine/`, y el directorio `backend/src/engine/` DEBERÁ dejar de existir.
5. CUANDO se complete la reubicación ENTONCES `services/scanner.ts`, `routes/scanner.ts`, `routes/setup-levels.ts`, `routes/candles.ts` y `alerts/ema-alert-evaluator.ts` DEBERÁN compilar y comportarse igual (mismos imports resueltos, sin cambios de lógica).
6. Los modelos Prisma `Strategy`, `BacktestRun`, `BacktestSetup` y `BacktestTrade` DEBERÁN eliminarse de `schema.prisma`, y una nueva migración DEBERÁ borrar las tablas `backtest_trades`, `backtest_setups`, `backtest_runs`, `strategies` en ese orden.
7. El modelo `SettingsMirror` y la tabla `settings_mirror` DEBERÁN quedar intactos.
8. Las carpetas de migraciones existentes NO DEBERÁN editarse ni borrarse.
9. Los directorios del frontend `features/backtest/` y `features/engine/` DEBERÁN borrarse, junto con las rutas `/backtest` y `/engine`, sus entradas de navegación en `AppLayout.tsx` y los iconos `IconBacktest` / `IconEngine`.
10. La prop `backtestOverlay`, sus tipos y la lógica `drawBacktestOverlay` DEBERÁN eliminarse de `LightweightChart.tsx`, y la página del gráfico en vivo DEBERÁ renderizar velas, EMAs, dibujos, posiciones y alertas exactamente como antes.
11. `npm run build` DEBERÁ completarse en `backend/` y `frontend/` sin errores de TypeScript tras cada commit.
12. CUANDO se despliegue el backend ENTONCES `prisma migrate deploy` DEBERÁ aplicar la migración de borrado sin intervención manual en el VPS.
13. NO DEBERÁN añadirse nuevas dependencias.

## Fuera de alcance

- Cualquier rediseño o reimplementación futura del motor o del backtest. El diseño de estrategias documentado en `.claude/CLAUDE.md` se conserva como referencia.
- Cambios en el EA (`ea/`), en el puente pipe/file-watcher o en el protocolo WebSocket.
- Eliminar el resto de feature flags (`FEATURE_PIPE`, `FEATURE_WATCHER`, `FEATURE_ALERTS`, `FEATURE_WS_BROADCAST`).
- Limpiar las secciones de `.claude/CLAUDE.md` que describen el motor (puede hacerse en un commit de documentación aparte).
- Hacer copia de seguridad de los datos de las cuatro tablas eliminadas. Solo contienen ejecuciones de prueba; el borrado es intencionado y definitivo.
