# 028 — Editar alertas de precio · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Solo frontend; un único despliegue de frontend al final.

- [x] 1. [frontend] `useAlerts.updatePrice` + panel de alertas: edición del precio en la fila (input, Guardar/Cancelar, Enter/Esc, validación, toast de error), On/Off y Delete con el estilo de Positions, la fila disparada atenúa solo símbolo y precio · **Verificar:** `npm run build` + prueba local en Vite (editar un precio, editar una alerta disparada → se reactiva, valor inválido) · **Est:** 2 SP
- [x] 2. [frontend] Gráfico: las alertas se suman al arrastre de SL/TP (unión `DraggableLevel`, hit test, línea discontinua al seleccionar, etiqueta en vivo con pips en desktop y solo precio en móvil, Esc cancela, guardado optimista vía `onMoveAlert`, vuelta atrás si falla) · **Verificar:** `npm run build` + prueba local (seleccionar, arrastrar, soltar, Esc, el arrastre de SL/TP sigue funcionando) · **Est:** 3 SP
- [x] 3. [frontend] `AlertActionBar` en móvil (Editar precio abre el panel editando esa alerta, On/Off, Eliminar) conectada con `onSelectAlert` · **Verificar:** `npm run build` + prueba local a ancho de móvil · **Est:** 1.5 SP
- [x] 4. [infra] Push de `master` (despliegue de frontend) y **validación en producción**: `/chart` en desktop e iPhone — arrastrar una alerta, Esc, editar precio en el panel, reactivar una alerta disparada, barra de acciones móvil, botones estilo Positions · **Verificar:** manual (validación del usuario) · **Est:** 0.5 SP
- [x] 5. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), cerrar la spec y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 7.25 SP
