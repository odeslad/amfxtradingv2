# 032 — Spread en el gráfico · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Las tareas de capas distintas nunca comparten commit. Orden de despliegue: db + backend primero (la columna debe existir antes de que el frontend la escriba), después frontend.

- [ ] 1. [db] Añadir `showSpread Boolean @default(false)` a `SettingsDisplay` y la migración escrita a mano `20261029000000_show_spread` · **Verificar:** `prisma generate` + `npm run build` en `backend/` · **Est:** 0.25 SP
- [ ] 2. [backend] Leer y escribir `display.showSpread` en `/settings` (validado con `optionalBoolean`, por defecto `false`) y cubrirlo en el test de ruta · **Verificar:** vitest + `npm run build` · **Est:** 0.5 SP
- [ ] 3. [frontend] Interruptor "Spread (líneas ASK y BID)" en Settings › Display con su texto de ayuda, `DEFAULT_DISPLAY.showSpread = false`, como en la maqueta · **Verificar:** `npm run build` + revisión en local contra la maqueta · **Est:** 0.5 SP
- [ ] 4. [frontend] Gráfico: ChartPage lee `showSpread` y pasa `last.ask` a `updateLive`; LightweightChart oculta la línea de precio de la serie y pinta las líneas ASK y BID cuando está activado (ASK solo cuando ha llegado un tick con ask) · **Verificar:** `npm run build` + revisión en local (activar/desactivar, las líneas se mueven con los ticks, CA 1–6) · **Est:** 1.5 SP
- [ ] 5. [infra] Push de `master` (primero el despliegue del backend, después el frontend cuando lo pida el usuario) y **validar en producción**: Settings › Display muestra el interruptor desactivado; al activarlo se ven ASK y BID en FTMO · EURUSD y se mueven con el precio; al desactivarlo vuelve la línea única; el ajuste sobrevive a una recarga y se ve igual en el móvil · **Verificar:** manual (validación del usuario) · **Est:** 0.5 SP
- [ ] 6. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/YYYY-MM/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 3.5 SP
