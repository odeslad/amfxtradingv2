# 006 — Números de build en el footer · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Las tareas de backend y frontend nunca comparten commit. Orden de deploy: backend (`/version` debe existir antes de que el footer lo pida) → frontend.

- [ ] 1. [backend] Añadir `src/version.ts` (recuento de commits de git para `backend` y `ea`, `0` + aviso `[VERSION]` ante fallo) y montar `GET /version` en `app.ts` junto a `/health` (AC 2, 3). · **Verificar:** `npm run build`; backend local → `curl /version` devuelve `{ "backend": 155, "ea": 28 }` (recuentos actuales) · **Est:** 0,5 SP
- [ ] 2. [frontend] `define` en `vite.config.ts` para `__BUILD_FRONTEND__` desde `git rev-list --count HEAD -- frontend`, declarado en `src/vite-env.d.ts` (AC 1, 3). · **Verificar:** `npm run build`; grep del bundle compilado con el recuento actual (157 + este commit) · **Est:** 0,5 SP
- [ ] 3. [frontend] Hook `src/lib/useBuildInfo.ts` + footer `build: F.B.E` en `AppLayout.tsx` con estilo `.build` (mono) en `AppLayout.module.css` (AC 4, 6). · **Verificar:** `npm run build`; frontend local contra backend local muestra `build: <F>.<B>.<E>`; con el backend parado muestra `build: <F>.?.?`; footer oculto a ≤ 768 px · **Est:** 1 SP
- [ ] 4. [infra] Push `master` → deploy del backend; el workflow del frontend se dispara en el mismo push porque cambió `frontend/**` — verificar ambas ejecuciones. **Validar en producción**: el footer muestra `build: F.B.E` con los tres recuentos coincidiendo con `git rev-list --count` en `master` para cada directorio; `curl https://api-v2.amfxtrading.com/version` coincide (AC 5) · **Verificar:** manual (validación del usuario) · **Est:** 0,5 SP
- [ ] 5. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec cerrada y archivarla en `archive/2026-09/` (o el mes de cierre) · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 2,75 SP

Nota sobre deploys: este push toca `backend/**` y `frontend/**` en commits separados pero un solo push, así que ambos workflows se disparan a la vez — puede ocurrir el fallo conocido de pull concurrente en el deploy del backend (memoria: relanzar `deploy.ps1` por SSH si pasa). Alternativa: hacer push del commit de backend primero, esperar su deploy, y luego push de los commits de frontend.
