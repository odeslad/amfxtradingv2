# 030 — Reflejo rápido de los trades cerrados · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [backend] El watcher salta history/account sin cambios, intervalo 5 s | build + vitest | `npx vitest run` · `npm run build` | ✅ pasa | 114/114 tests (5 nuevos en `file-watcher.test.ts`: 5 s por defecto, historial sin cambios se pasa una vez aunque se reescriba, contenido distinto se pasa, handler que falla se reintenta, cuenta sin cambios se salta); `tsc` limpio | 1 | 0.5 |
| 2. [backend] Emitir `trades_updated` tras sincronizar un historial con cambios; docs | build + vitest | `npx vitest run` · `npm run build` | ✅ pasa | 115/115 tests (nuevo: `trades_updated` llega al cliente con `broker` en la raíz); `tsc` limpio; `architecture.md` + `.claude/CLAUDE.md` actualizados | 0.5 | 0.25 |
| 3. [frontend] `useTradesUpdated` + recarga de Stats / Historial | build + manual | `npm run build` · `eslint` en los 3 ficheros | ✅ pasa | Build y lint limpios. La prueba local contra el túnel a la BD no puede generar `trades_updated` (el backend local corre con `FEATURE_WATCHER=false`), así que el refresco se validó en producción en la tarea 5 | 1 | 0.25 |
| 4. [ea] `history.json` al cambiar el historial, ≥ `HISTORY_MIN_GAP_S` entre escrituras (EA 3.15) | compilación del pipeline del EA | push `a8982da` → Deploy EA to VPS #41 | ✅ pasa | "Compile EA files" y "Distribute to all MT4 instances" en verde; la misma ejecución recarga los 12 terminales vía AMFX-Watchdog (sin recarga manual) | 0.5 | 0.25 |
| 5. [infra] Push y validación en producción | manual (usuario) | pushes `09602e2` (backend, run #173 verde) → `a10d63a` (frontend) → `a8982da` (EA, run #41) | ✅ pasa | El usuario cerró una posición con Historial y Stats abiertos: ambos la mostraron sin recargar (2026-10-29) | 1 | 0.5 |
| 6. [specs] Cierre | manual | `npm run build` de backend + frontend | ✅ pasa | Los dos builds limpios | 0.25 | 0.25 |

**Total**: Est 4.25 SP · Real 2 SP.

**Calibración**: spec pequeña entre capas sobre código conocido; las estimaciones por capa salieron casi al doble. La espera del despliegue (recarga del EA en 12 terminales, ~15 min) no es tiempo de desarrollo y no se cuenta.

**Desviaciones**
- Tarea 3: la prueba manual pasó del dev local a producción (el backend local tiene el watcher apagado).
- Tarea 4: el EA lo compila y recarga su pipeline, no MetaEditor a mano; se corrigió el texto de las tareas.

**Pendiente / seguimiento**
- El run #41 dio `[FAILED]` falsos en la recarga (Darwinex, IV, VI, VII, IX y X volvieron después; el propio script terminó con 12/12 terminales en marcha): AMFX-Watchdog ignora `/run` mientras ya está corriendo. Apuntado como spec futura para `restart-mt4.ps1`.
