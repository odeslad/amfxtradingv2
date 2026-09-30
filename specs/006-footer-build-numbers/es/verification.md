# 006 — Números de build en el footer · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` desde `C:\` y `tsx -e import './src/version'`; backend local en 3001 → `curl /version` | ✅ | `tsc` limpio; ambos puntos de entrada dan `{"backend":155,"ea":28}` independientemente del cwd (coincide con `git rev-list --count HEAD -- backend` / `-- ea` en `master`); `GET /version` → `200` sin cookie. | 0,5 | 0,5 | — |
