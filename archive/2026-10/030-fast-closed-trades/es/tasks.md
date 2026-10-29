# 030 — Reflejo rápido de los trades cerrados · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: backend → frontend → ea (el EA solo necesita recarga vía Watchdog; backend + frontend ya traen el watcher a 5 s y el refresco automático).

- [x] 1. [backend] `FileWatcher`: saltar `history.json` / `account.json` sin cambios (por `mtime`/tamaño y luego contenido), recordarlos solo si el handler termina bien, intervalo por defecto 5 s; tests de sin cambios / con cambios / handler que falla · **Verificar:** `npm run build` + vitest · **Est:** 1 SP
- [x] 2. [backend] Emitir `{ type: "trades_updated", broker }` tras sincronizar un historial modificado; actualizar `backend/docs/architecture.md` y las líneas de WS/watcher de `.claude/CLAUDE.md` · **Verificar:** `npm run build` + vitest (broadcast WS) · **Est:** 0.5 SP
- [x] 3. [frontend] `lib/useTradesUpdated.ts` (filtro WS por broker + debounce de 1 s); Stats e Historial (posiciones cerradas) vuelven a pedir datos con él sin parpadeo de carga · **Verificar:** `npm run build` + manual en dev local contra el túnel a la BD de producción · **Est:** 1 SP
- [x] 4. [ea] Escribir `history.json` en cuanto cambia `OrdersHistoryTotal()`, como mucho cada `HISTORY_MIN_GAP_S` (3 s); el ciclo de 60 s se mantiene · **Verificar:** compilación del pipeline del EA (deploy-ea.yml) + `[STATE] History changed` en el log del terminal tras cerrar un trade demo · **Est:** 0.5 SP
- [x] 5. [infra] Push de `master` (backend primero; frontend cuando lo pida el usuario; el pipeline del EA compila y recarga los terminales vía AMFX-Watchdog) y **validar en producción**: cerrar una posición con Historial y Stats (ese broker, periodo Todo) abiertos → ambos la muestran en ~10 s sin recargar; el log del backend no muestra upserts de history/account mientras no cambia nada · **Verificar:** manual (validación del usuario) · **Est:** 1 SP
- [x] 6. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-10/` (o el mes de cierre) · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 4.25 SP
