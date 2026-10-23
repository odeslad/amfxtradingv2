# 022 — Eliminar la sección Scanner · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: frontend → backend (la página deja de llamar al endpoint antes de que desaparezca).

- [x] 1. [frontend] Borrar `features/scanner/`, `lib/useScanner.ts`, la ruta `/scanner`, la entrada de navegación e `IconScanner` · **Verificar:** `npm run build` + `npm run lint`; `git grep -i scanner frontend/src` vacío; app local: navegación sin Scanner en escritorio y móvil, `/scanner` aterriza en el Journal, New Trade sigue mostrando los niveles del setup · **Est:** 0,5 SP
- [x] 2. [backend] Borrar `routes/scanner.ts` y `services/scanner.ts`, desmontar en `app.ts`; `docs/architecture.md` y `.claude/CLAUDE.md` actualizados (16 routers) · **Verificar:** `npm run build`; `git grep -i scanner backend/src` vacío; backend local: `GET /scanner` → 404, `GET /setup-levels?…` sin cambios · **Est:** 0,5 SP
- [x] 3. [infra] Push de `master` (despliegues de frontend y backend) y **validar en producción**: sin Scanner en la navegación, `/scanner` → Journal, niveles de New Trade, una alerta EMA sigue listada y evaluándose, `GET /scanner` → 404 · **Verificar:** manual (validación del usuario) · **Est:** 0,25 SP
- [x] 4. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec cerrada y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 1,5 SP
