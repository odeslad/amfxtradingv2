# 034 — Candado del gráfico · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Solo frontend; despliegue cuando lo pida el usuario.

- [ ] 1. [frontend] Estado del candado en `ChartPage` (localStorage `amfx.chartLocked`, se quita al elegir una herramienta de dibujo o la regla), `IconLock` / `IconUnlock` y el botón de la barra tras la campana de alertas · **Verificar:** `npm run build` + comprobación local de que el botón alterna y sobrevive a una recarga · **Est:** 0.75 SP
- [ ] 2. [frontend] Respetar el candado en `DrawingTools` (sin seleccionar / arrastrar / duplicar con Ctrl, sin editar con doble clic, sin Supr; deselecciona al bloquear) y en `LightweightChart` (se salta el arrastre de SL / TP / alertas, se limpia la selección, se cancela el arrastre en curso, etiquetas de posición con `pointer-events: none` y sin ✕) · **Verificar:** `npm run build` + comprobación local de dibujos, niveles y alertas con candado activado y desactivado · **Est:** 1.5 SP
- [ ] 3. [infra] Push de `master` (deploy del frontend) y **validar en producción**: página Chart en escritorio y móvil — con candado, arrastrar / rueda sobre un dibujo, una línea SL/TP, una etiqueta de posición y una alerta mueve el gráfico y no cambia nada; recargar mantiene el candado; elegir Trendline lo quita · **Verificar:** manual (validación del usuario) · **Est:** 0.25 SP
- [ ] 4. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec cerrada y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 2.75 SP
