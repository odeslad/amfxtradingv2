# 026 — UX de la página de esquemas · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + app local en ancho de escritorio | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 2 | 1 |
| 2 [frontend] | build + lint + app local a 390 px | `npm run build` · `npm run lint` · Vite en el 5174, modo dispositivo | ✅ pasa | 1,5 | 1 |
| 3 [frontend] | build + lint + app local a 390 px | `npm run build` · `npm run lint` · Vite en el 5174, modo dispositivo | ✅ pasa | 2 | 1 |
| 4 [infra] | manual (validación del usuario en producción) | push `bbfa983..debb3fc`, "Deploy Frontend to VPS" en verde | ✅ pasa | 0,5 | 0,5 |
| 5 [specs] | manual | este fichero, `Estado: cerrada`, `git mv` a `archive/2026-10/` | ✅ pasa | 0,25 | 0,25 |

**Total**: Est 6,25 SP · Real 3,75 SP. Calibración: muy por debajo de la estimación porque cada pieza
reutilizó un patrón existente (barra de pestañas y acciones de fila del Journal, `PositionCard` y
`useSwipeActions`, el armazón compartido de los paneles); las iteraciones de la maqueta con el usuario, que
concentraron casi todo el diseño, no cuentan contra las tareas.

## Evidencia

### Tarea 1

Build y lint limpios. Aceptado por el usuario el 26-10-2026 en la app local con datos de producción:
barra de pestañas por año con + Nuevo esquema a la derecha, franja de totales en una fila, filas de esquema
(Inicio → Fin en una columna) estiradas hasta el borde derecho, acciones al pasar el ratón como en el
Journal (Editar naranja / Eliminar rojo) en filas de esquema y operación que abren los paneles correctos
sin plegar la fila, operaciones en 10 columnas sin scroll lateral, resultado sin borde, paginación ‹ ›
compacta. La disposición del teléfono no cambia hasta las tareas 2–3, como se esperaba.

### Tarea 2

Build y lint limpios; aceptada por el usuario el 26-10-2026 antes de pasar a la tarea 3: pestañas de año a
ancho completo y + Nuevo esquema de 44 px, bloque de totales (título, Neto € / Neto R a 28 px, cuatro
recuentos con etiqueta), la nueva `SchemeCard` cerrada (▸ #N, resultado, Inicio / Neto € / Neto R) y
abierta (rejilla con etiquetas, tres acciones de 44 px), paginación de 44 px. Ver operaciones llega con la
tarea 3.

### Tarea 3

Build y lint limpios. Validada por el usuario el 26-10-2026: Ver operaciones abre el `OperationsPanel` a
pantalla completa; operaciones en formato de card de Positions (resumen Posición / Entrada / R, toque para
desplegar en filas con etiqueta, deslizar a la izquierda para Editar / Eliminar); el panel de operación y la
confirmación se apilan encima y vuelven a la lista ya refrescada; + Nueva operación al pie. El panel de
operaciones es un estado aparte en `BookPage`, así que el apilado del diseño funcionó sin el plan B.
Arreglado de paso: las cabeceras de las columnas numéricas de las dos tablas de escritorio iban a la
izquierda sobre números a la derecha (`.table th` pisaba a `.num`).

### Tarea 4

Push `bbfa983..debb3fc` (tres commits de frontend); "Deploy Frontend to VPS" correcto y producción sirvió el
bundle nuevo. Aceptado por el usuario en producción (escritorio e iPhone) contra los CA 1–10 el 27-10-2026.

### Tarea 5

Cerrada y archivada en `archive/2026-10/`.
