# 030 — Reflejo rápido de los trades cerrados · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [backend] El watcher salta history/account sin cambios, intervalo 5 s | build + vitest | `npx vitest run` · `npm run build` | ✅ pasa | 114/114 tests (5 nuevos en `file-watcher.test.ts`: 5 s por defecto, historial sin cambios se pasa una vez aunque se reescriba, contenido distinto se pasa, handler que falla se reintenta, cuenta sin cambios se salta); `tsc` limpio | 1 | 0.5 |
| 2. [backend] Emitir `trades_updated` tras sincronizar un historial con cambios; docs | build + vitest | `npx vitest run` · `npm run build` | ✅ pasa | 115/115 tests (nuevo: `trades_updated` llega al cliente con `broker` en la raíz); `tsc` limpio; `architecture.md` + `.claude/CLAUDE.md` actualizados | 0.5 | 0.25 |
