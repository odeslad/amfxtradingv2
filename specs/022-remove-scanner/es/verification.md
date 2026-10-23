# 022 — Eliminar la sección Scanner · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `npm run build` + `npm run lint` + `git grep` + app local (usuario) | ✅ | 0,5 | 0,25 |
| 2 | `npm run build` + `git grep` + sondeos al backend local | ✅ | 0,5 | 0,5 |

## Tarea 1 — Página Scanner, hook, ruta, entrada de navegación e icono retirados (frontend)

- Borrados `src/features/scanner/` (página + módulo CSS) y `src/lib/useScanner.ts`; `app/Router.tsx` sin el import ni la ruta `/scanner` (la ruta `*` la manda a `/` → `/journal`); `app/layout/AppLayout.tsx` sin la entrada Scanner de la navegación; `shared/ui/icons.tsx` sin `IconScanner`.
- `npm run build` y `npx eslint src` limpios; `git grep -i scanner -- frontend/src` vacío.
- App local (Vite 5174 contra la API de producción), comprobada por el usuario el 23-10-2026: navegación sin Scanner, `/scanner` aterriza en el Journal, New Trade sigue mostrando los niveles del setup.
- Est vs Real: 0,5 vs 0,25 SP.

## Tarea 2 — Ruta y servicio del scanner retirados, documentación actualizada (backend)

- Borrados `src/routes/scanner.ts` y `src/services/scanner.ts`; `app.ts` sin el import ni el montaje de `/scanner` (16 routers). `docs/architecture.md`: fuera la línea del árbol y la fila de endpoints; `.claude/CLAUDE.md`: lista de routers 17 → 16. `indicators/*` sin tocar.
- `npm run build` limpio; `grep -ri scanner backend/src backend/docs .claude/CLAUDE.md` vacío.
- Backend local (3001, bridges apagados, base de datos de producción por el túnel 5433): `GET /scanner?…` → 404 (sin router, igual que `/nonexistent`), `GET /setup-levels?…` → 401 sin cookie, es decir, sigue montado tras `requireAuth`; `/health` 200.
- Est vs Real: 0,5 vs 0,5 SP.
