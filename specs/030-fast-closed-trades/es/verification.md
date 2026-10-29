# 030 — Reflejo rápido de los trades cerrados · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [backend] El watcher salta history/account sin cambios, intervalo 5 s | build + vitest | `npx vitest run` · `npm run build` | ✅ pasa | 114/114 tests (5 nuevos en `file-watcher.test.ts`: 5 s por defecto, historial sin cambios se pasa una vez aunque se reescriba, contenido distinto se pasa, handler que falla se reintenta, cuenta sin cambios se salta); `tsc` limpio | 1 | 0.5 |
