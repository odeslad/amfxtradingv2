# 022 — Eliminar la sección Scanner · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `npm run build` + `npm run lint` + `git grep` + app local (usuario) | ✅ | 0,5 | 0,25 |

## Tarea 1 — Página Scanner, hook, ruta, entrada de navegación e icono retirados (frontend)

- Borrados `src/features/scanner/` (página + módulo CSS) y `src/lib/useScanner.ts`; `app/Router.tsx` sin el import ni la ruta `/scanner` (la ruta `*` la manda a `/` → `/journal`); `app/layout/AppLayout.tsx` sin la entrada Scanner de la navegación; `shared/ui/icons.tsx` sin `IconScanner`.
- `npm run build` y `npx eslint src` limpios; `git grep -i scanner -- frontend/src` vacío.
- App local (Vite 5174 contra la API de producción), comprobada por el usuario el 23-10-2026: navegación sin Scanner, `/scanner` aterriza en el Journal, New Trade sigue mostrando los niveles del setup.
- Est vs Real: 0,5 vs 0,25 SP.
