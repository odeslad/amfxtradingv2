# 013 · BE-07 — Corrección del sizing por % de riesgo · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: solo backend.

- [x] 1. [backend] Regla JPY de `getPipSize` para pares no listados + `pip-size.test.ts`; `sizing.ts` con `SizingInput` / `SizingResult` (comprobación forex, precio de entrada, `no_conversion` / `zero_stop` / `not_forex` explícitos); `sizing.test.ts` reescrito; llamada en `routes/commands.ts` con `price ?? bid` y el mapeo 400/503 (AC 1–7) · **Verificar:** `npm run lint && npm run typecheck && npm test` + `npm run build`; en el backend local (pipe/watcher apagados) no se pueden sembrar ticks ni cuenta sin el pipe → el mapeo de la ruta se comprueba con los tests unitarios del módulo puro más el typecheck de la llamada · **Est:** 1,25 SP
- [ ] 2. [infra] Push de `master` (deploy backend) y **validar en producción**, modo risk %, sin ejecutar donde se espera un rechazo: (a) orden a mercado EURUSD con riesgo 0,5 % y un SL → mismos lotes que antes del deploy (el usuario compara con el tamaño habitual); (b) orden pendiente (buy limit) lejos del mercado con la misma distancia de SL respecto a su precio → mismos lotes que (a), no los de la distancia al bid; (c) un símbolo no forex que ofrezca el broker (p. ej. oro) → toast `Risk % sizing supports forex pairs only…`, no se envía nada; (d) SL igual a la entrada → `SL must differ from the entry price` · **Verificar:** manual (validación del usuario) · **Est:** 0,5 SP
- [ ] 3. [specs] Registrar Est vs Real, columna `Spec` de BE-07 → `013 ✅`, `Status: closed`, archivar en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 2 SP (auditoría: 2 SP)
