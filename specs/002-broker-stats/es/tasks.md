# 002 — Estadísticas por broker · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar y funcionar tras cada tarea. Las tareas de backend (1–3) y de frontend (4–9) nunca comparten commit.

## Backend

- [x] 1. Crear `backend/src/services/stats.ts` con `computeBrokerStats(broker, from?, to?)`: agregado de operaciones, agrupado mensual con meses a cero, `tradesPerMonth`, resolución del balance inicial (`snapshot` → `derived` → `none`) y `returnPct`. Exportar el tipo `BrokerStats`. `npm run build` pasa. — Diseño § Cálculo. `feat(backend): add broker stats service` [SP: 3]

- [x] 2. Crear `backend/src/routes/stats.ts` (`GET /`, valida `broker` contra `balances`, 400 si es desconocido, parsea `from`/`to`, llama al servicio) y montarla en `app.ts` bajo `/stats` con `requireAuth`. `npm run build` pasa. — Diseño § `GET /stats`. `feat(backend): expose GET /stats endpoint` [SP: 1]

- [x] 3. Verificar contra la base de datos del VPS por el túnel con el backend local: `/stats?broker=darwinex` devuelve un payload cuyo `trades` coincide con `SELECT count(*) FROM trades WHERE broker='darwinex'`, `monthly` cubre todos los meses sin huecos, un `from` dentro del rango de `balances` da `startBalanceSource: 'snapshot'`, un `from` anterior a junio de 2026 da `'derived'`, un broker sin operaciones en el periodo devuelve ceros y un broker desconocido devuelve 400. Sin commit; registrar el resultado en Outcome. — Requisitos CA 3, 5, 6, 10, 11. [SP: 1]

## Frontend

- [x] 4. Ampliar `features/journal/utils/dateRange.ts`: añadir `this_month`, `this_year`, `last_3_months` a `DateRange` y `dateRangeBounds`; mover `DATE_RANGE_OPTIONS` ahí desde `FiltersPanel.tsx` e importarlo de vuelta. Comprobar que el filtro History del Journal sigue funcionando con todos los presets. `npm run build` pasa. — Diseño § Archivos afectados (frontend). `refactor(frontend): share date range presets and add month/year ranges` [SP: 2]

- [x] 5. Crear `features/stats/types.ts` (`BrokerStats`) y `features/stats/StatTile.tsx` + `StatTile.module.css` (etiqueta, valor mono, color según tono, aviso opcional; panel `--surface` con borde superior de 3px `--orange`). `npm run build` pasa. — Diseño § `StatTile`. `feat(frontend): add StatTile component` [SP: 1]

- [x] 6. Crear `features/stats/StatsFilters.tsx` + `.module.css`: select de broker, select de periodo desde el `DATE_RANGE_OPTIONS` compartido, inputs desde/hasta en custom; se apila en móvil. `npm run build` pasa. — Diseño § `StatsFilters`. `feat(frontend): add StatsFilters component` [SP: 2]

- [x] 7. Crear `features/stats/MonthlyBreakdown.tsx` + `.module.css`: tabla de escritorio (Month · Trades · Net P&L) en un contenedor `overflow-x: auto`, cards móviles por debajo de 768px, etiqueta del mes desde `YYYY-MM` sin parsear con `Date`, P&L coloreado con `fmtPnl`. `npm run build` pasa. — Diseño § `MonthlyBreakdown`. `feat(frontend): add MonthlyBreakdown component` [SP: 2]

- [x] 8. Crear `features/stats/StatsPage.tsx` + `.module.css`: filtros en `useLocalStorage('stats.filters')`, lista de brokers desde `/balances` con fallback al primero, fetch a `/stats` al cambiar filtros, estados cargando / error / vacío, cinco tiles (operaciones por mes, % de rendimiento con `—` y aviso de derivado, P&L neto, total de operaciones, ratio de acierto) y el desglose mensual. Añadir `IconStats` a `shared/ui/icons.tsx`, la ruta `/stats` en `Router.tsx` y la entrada de navegación en `AppLayout.tsx` entre Scanner y Settings. `npm run build` pasa. — Diseño § `StatsPage`; § Archivos afectados. `feat(frontend): add Stats page` [SP: 3]

- [x] 9. Verificar en local contra el backend del VPS en escritorio y ancho de móvil: cambio de broker, todos los presets de periodo y rango custom, `—` y aviso en periodos derivados, estado vacío para un broker sin operaciones, filtro History del Journal intacto, consola del navegador limpia. Sin commit; registrar el resultado en Outcome. El frontend solo se despliega cuando el usuario lo pida. — Requisitos CA 1, 2, 4, 7, 8, 9. [SP: 1]

## Estimación

Total: 16 SP.

Referencia: spec 001 — sus tareas de 1–2 SP (1, 2, 3, 7) fueron mecánicas y bien estimadas, sus tareas de verificación (4, 8) fueron de 1 SP y acertadas. La tarea 1 de aquí es lógica de agregación nueva con casos límite (relleno a cero, dos orígenes de balance), dimensionada como la tarea 5 de 001 (3 SP); la tarea 8 cablea cuatro archivos nuevos más tres existentes, también 3 SP. Ninguna tarea llega a 5 SP, así que no hace falta dividir ninguna.

## Resultado

**Entregado (2026-09-15).** `GET /stats` en el backend, presets de rango de fechas compartidos y una nueva página Stats en el frontend, en 8 commits. Backend verificado contra la base de datos de producción por el túnel (tarea 3): el recuento all-time de darwinex coincide con `count(*)`, los buckets mensuales no tienen huecos, los orígenes `snapshot` / `derived` se resuelven según el diseño, los periodos vacíos devuelven ceros. Frontend verificado por el usuario en un entorno dev local (backend en 3001, Vite en 5174, túnel en 5434) (tarea 9): cambio de broker, todos los presets y rango custom, aviso de derivado, estado vacío, layout móvil, filtro History del Journal intacto, consola limpia. Backend aún no desplegado al escribir esto; el frontend solo se despliega cuando el usuario lo pida.

**Desviaciones acordadas:** `StatsPage` deriva su estado de carga de una clave de petición en lugar de llamar a `setState` dentro del efecto de fetch (el patrón del Journal dispara `react-hooks/set-state-in-effect`); las respuestas tardías se descartan. Mismo comportamiento, limpio para el linter.

**Incidente:** un `git stash push` sobre ficheros entonces sin trackear no hizo nada, así que el `stash pop` posterior restauró un stash antiguo sin relación y produjo conflictos en `features/journal`. Resuelto restaurando esos ficheros a HEAD; el stash antiguo sigue en la lista, intacto. Lección: nunca encadenar `stash push`/`pop` alrededor de commits cuando las rutas puedan estar sin trackear.

**Esfuerzo real:**
- Tarea 1: estimada 3, acertada — los dos orígenes de balance y el caso derivado acotado por `to` requirieron cuidado.
- Tarea 2: estimada 1, acertada.
- Tarea 3: estimada 1, pareció 2 — un script tsx contra el túnel, más un choque de puerto en 5433 con el túnel de otro proyecto.
- Tarea 4: estimada 2, pareció 1 — cambio aditivo, sin sorpresas.
- Tarea 5: estimada 1, acertada.
- Tarea 6: estimada 2, pareció 1 — copiado el estilo de inputs de `FiltersPanel`.
- Tarea 7: estimada 2, acertada.
- Tarea 8: estimada 3, acertada — la regla de lint obligó a reescribir ligeramente el estado de carga.
- Tarea 9: estimada 1, acertada; las comprobaciones de UI autenticada las hizo el usuario.
