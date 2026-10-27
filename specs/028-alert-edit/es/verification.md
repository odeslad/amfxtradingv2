# 028 — Editar alertas de precio · Verificación

## Tarea 1 — Panel de alertas: edición del precio en la fila y botones estilo Positions

- **Mecanismo:** `npm run build` + prueba local en Vite (`https://local.amfxtrading.com:5174/chart`, contra la API de producción).
- **Comandos:** `cd frontend && npm run build` → ✓ built.
- **Resultado:** ✅ pass — confirmado por el usuario en local.
- **Evidencia:** toda la fila (salvo los botones) abre la edición; Guardar/Cancelar, Enter/Esc; valor inválido → borde rojo; guardar reactiva la alerta (`PUT { price, enabled: true }`); On/Off y Delete con borde naranja/rojo y entrando desde la derecha como en Positions (hover en desktop, deslizar en táctil, `AlertRow`, usado también en la pestaña EMA); las filas en Off/disparadas atenúan solo símbolo y precio.
- **Desviaciones acordadas con el usuario:** edición desde toda la fila en lugar de solo el precio; botones ocultos que entran como en Positions; el precio actual sale del placeholder de Price a su propia fila bajo el formulario.
- **Est vs Actual:** 2 SP vs 2,5 SP — los tres ajustes acordados.

## Tarea 2 — Gráfico: arrastrar alertas como SL/TP

- **Mecanismo:** `npm run build` + `eslint src/features/chart/` + prueba local en Vite.
- **Comandos:** `cd frontend && npm run build` → ✓ built; eslint → limpio.
- **Resultado:** ✅ pass — confirmado por el usuario en local.
- **Evidencia:** las alertas se suman al arrastre de SL/TP (unión `DraggableLevel`); una alerta sin seleccionar solo se coge junto a su marca, una seleccionada en todo el panel; seleccionada = línea naranja discontinua que se corta antes de la etiqueta de precio; al arrastrar se ve una línea tenue en el precio inicial y una etiqueta centrada en la línea (`▲ precio · ±pips` en desktop, `▲ precio` en móvil); al soltar se guarda redondeado a la precisión del símbolo (override optimista, se descarta si falla con un toast); Esc restaura y no guarda (también SL/TP). Soltar un SL/TP sin moverlo ya no envía un modify.
- **Desviación:** la línea de selección cruzaba la etiqueta de precio (parecía un precio viejo tachado); corregido para que se corte antes.
- **Est vs Actual:** 3 SP vs 3 SP.

## Tarea 3 — Barra de acciones de alerta en móvil

- **Mecanismo:** `npm run build` + `eslint src/features/chart/` + prueba en el iPhone en producción.
- **Comandos:** `cd frontend && npm run build` → ✓ built; eslint → limpio.
- **Resultado:** 🕐 pendiente — el usuario lo prueba en el iPhone tras el despliegue (tarea 4).
- **Evidencia:** al seleccionar una alerta en el gráfico aparece `AlertActionBar` abajo del gráfico (solo a ancho de móvil): Edit price (abre el panel de alertas editando esa alerta), On/Off, Delete; la barra se va al deseleccionar, borrar la alerta o cambiar de símbolo. Tolerancia táctil subida a 18 px (el ratón sigue en 6 px) para que el dedo enganche las líneas de alertas y SL/TP.
- **Est vs Actual:** 1,5 SP vs 1,5 SP.
