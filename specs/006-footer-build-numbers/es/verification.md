# 006 — Números de build en el footer · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` desde `C:\` y `tsx -e import './src/version'`; backend local en 3001 → `curl /version` | ✅ | `tsc` limpio; ambos puntos de entrada dan `{"backend":155,"ea":28}` independientemente del cwd (coincide con `git rev-list --count HEAD -- backend` / `-- ea` en `master`); `GET /version` → `200` sin cookie. | 0,5 | 0,5 | — |
| 2 | build | `npm run build` (`tsc -b && vite build`); `npm run lint` | ✅ | Build limpio con `define` + `vite-env.d.ts`. La constante aún no se referencia, así que el grep del bundle pasa a la tarea 3. `npm run lint` reporta 33 problemas preexistentes en 15 ficheros ajenos (ninguno en los tocados) — anotado para la auditoría del frontend, no se arregla aquí. Recuento actual: 157 (este commit lo deja en 158). | 0,5 | 0,5 | — |
