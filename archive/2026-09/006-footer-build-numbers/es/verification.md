# 006 — Números de build en el footer · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` desde `C:\` y `tsx -e import './src/version'`; backend local en 3001 → `curl /version` | ✅ | `tsc` limpio; ambos puntos de entrada dan `{"backend":155,"ea":28}` independientemente del cwd (coincide con `git rev-list --count HEAD -- backend` / `-- ea` en `master`); `GET /version` → `200` sin cookie. | 0,5 | 0,5 | — |
| 2 | build | `npm run build` (`tsc -b && vite build`); `npm run lint` | ✅ | Build limpio con `define` + `vite-env.d.ts`. La constante aún no se referencia, así que el grep del bundle pasa a la tarea 3. `npm run lint` reporta 33 problemas preexistentes en 15 ficheros ajenos (ninguno en los tocados) — anotado para la auditoría del frontend, no se arregla aquí. Recuento actual: 157 (este commit lo deja en 158). | 0,5 | 0,5 | — |
| 3 | build + manual (usuario, frontend local vía proxy de Vite) | `npm run build`; grep del bundle; `npm run lint` (ficheros tocados limpios); frontend local contra backend local | ✅ | El bundle contiene `frontend:158` y la plantilla `build: ` con fallbacks `??"?"`. Captura del usuario: el footer dice `AMFX Trading Terminal v2.0 · © 2026 · build: 158.155.28` en mono. El estado `?` no se puede observar en la UI sin backend (el footer vive dentro del layout autenticado); verificado solo por código/bundle. Regla móvil intacta. | 1 | 0,75 | — |
| 4 | manual (validación del usuario en producción) | dos pushes: `5075c25..e9e4469` (solo backend → deploy del backend; `/version` en prod → `{"backend":156,"ea":28}`, pm2 online, 0 reinicios) y después `e9e4469..0a434b6` (solo frontend → deploy del frontend; VPS en `0a434b6`, el bundle servido contiene `frontend:159`) | ✅ | Recuentos en `master`: frontend 159, backend 156, ea 28. El usuario confirmó que el footer de producción dice `build: 159.156.28` (AC 5: el push del frontend movió solo el primer número, el del backend solo el segundo). Sin incidente de pull concurrente gracias al push dividido. | 0,5 | 0,5 | El host del frontend en producción está tras Cloudflare; se verificó el bundle en el VPS en vez de por HTTP. |
| 5 | manual | `Status: closed`; `git mv` a `archive/2026-09/` | ✅ | — | 0,25 | 0,25 | — |
| **Total** | | | | | **2,75** | **2,5** | Exacto; la tarea 3 algo por debajo (el footer ya existía). Preexistente: `npm run lint` en el frontend reporta 33 problemas en 15 ficheros — entrada para la auditoría del frontend. |

## Desviaciones acordadas durante la implementación

- El fallback `?` (AC 4) se verifica solo por código/bundle: el footer vive dentro del layout autenticado, inalcanzable sin backend.
- Push en dos pasos (backend, luego frontend) para evitar el fallo conocido de pull concurrente.

## Pendiente del usuario

Nada.
