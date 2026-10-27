# 028 — Editar alertas de precio · Verificación

## Tarea 1 — Panel de alertas: edición del precio en la fila y botones estilo Positions

- **Mecanismo:** `npm run build` + prueba local en Vite (`https://local.amfxtrading.com:5174/chart`, contra la API de producción).
- **Comandos:** `cd frontend && npm run build` → ✓ built.
- **Resultado:** ✅ pass — confirmado por el usuario en local.
- **Evidencia:** toda la fila (salvo los botones) abre la edición; Guardar/Cancelar, Enter/Esc; valor inválido → borde rojo; guardar reactiva la alerta (`PUT { price, enabled: true }`); On/Off y Delete con borde naranja/rojo y entrando desde la derecha como en Positions (hover en desktop, deslizar en táctil, `AlertRow`, usado también en la pestaña EMA); las filas en Off/disparadas atenúan solo símbolo y precio.
- **Desviaciones acordadas con el usuario:** edición desde toda la fila en lugar de solo el precio; botones ocultos que entran como en Positions; el precio actual sale del placeholder de Price a su propia fila bajo el formulario.
- **Est vs Actual:** 2 SP vs 2,5 SP — los tres ajustes acordados.
