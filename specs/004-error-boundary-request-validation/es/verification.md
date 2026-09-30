# 004 — Frontera de errores y validación de peticiones · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | build + script local | `npm run build`; `verify-task1.js` desechable (Express + `asyncRoute`/`errorHandler` compilados, rutas `/boom` que lanza, `/bad` que lanza `BadRequest`, `/stray` que rechaza una promesa sin esperar, `/ok`) | ✅ | `tsc` limpio. `/boom` → `500 {"error":"Internal error"}` con `[HTTP] GET /boom` + stack en stderr; `/bad` → `400 {"error":…,"message":…}`; `/stray` registra `[UNHANDLED] rejection`; `/ok` → 200 después, proceso vivo. Script no commiteado. | 1 | 1 | Verificado contra el `dist/` compilado en vez de una ruta temporal en `app.ts` (sin necesidad de BD). |
