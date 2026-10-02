# 011 — Vitalidad de la fila de Cuentas · Tareas

Cada tarea es un commit convencional. Orden de despliegue: solo backend.

- [x] 1. [backend] `isPipeLive` / `pipeStateOf` en `store/liveness.ts` con tests; `daily-pnl` salta los brokers no vivos (AC 1–4) · **Verificar:** `npm run lint && npm run typecheck && npm test` + `npm run build` · **Est:** 0,25 SP
- [x] 2. [infra] Push de `master` (deploy backend) y **validar en producción**: el usuario vuelve a quitar un EA → su fila de Cuentas se pone gris en ≤ 5 s, Day P&L `—`; al reponerlo → la fila vuelve a la normalidad; el resto de filas sin cambios · **Verificar:** manual (validación del usuario) · **Est:** 0,25 SP
- [x] 3. [specs] Registrar Est vs Real, `Status: closed`, archivar en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,1 SP

**Estimación total**: 0,6 SP
