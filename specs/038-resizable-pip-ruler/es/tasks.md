# 038 — Regla de pips redimensionable · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: solo frontend.

- [x] 1. [frontend] Rehacer la regla en `DrawingTools.ts`: un único estado `ruler` de dos anclas, medición a través de `drawStart` + `commitSecondAnchor` (pulsar-arrastrar-soltar táctil incluido), selección con el id reservado `'ruler'`, hit test (handles, diagonal, caja), arrastre de un extremo o de la regla entera, eliminación con Supr / Escape / Borrar todo / `loadPersisted`, el bloqueo la conserva, handles pintados al seleccionar o en preview; contador de dibujos sin cambios · **Verificar:** `npm run build` + manual en local: medir, redimensionar un extremo, mover, deseleccionar / reseleccionar, Supr, Escape, Borrar todo, el cambio de timeframe la limpia, el bloqueo la ignora, nunca en el payload de `/drawings` · **Est:** 1.5 SP
- [ ] 2. [infra] Push de `master` (deploy de frontend) y **validar en producción contra la spec**: página Chart, medir una regla en cualquier símbolo, arrastrar cada handle y la caja (AC 1–2), clic fuera y de vuelta, Supr / Escape / Borrar todo, cambiar timeframe (AC 3), bloqueo (AC 4), pulsar-arrastrar-soltar y arrastres de handle en móvil (AC 5), botón Delete con la regla seleccionada y ningún rectángulo guardado en `/drawings` tras recargar (AC 6) · **Verificar:** manual (validación del usuario) · **Est:** 0.25 SP
- [ ] 3. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 2 SP
