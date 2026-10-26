# 026 — UX de la página de esquemas · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + app local en ancho de escritorio | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 2 | 1 |

## Evidencia

### Tarea 1

Build y lint limpios. Aceptado por el usuario el 26-10-2026 en la app local con datos de producción:
barra de pestañas por año con + Nuevo esquema a la derecha, franja de totales en una fila, filas de esquema
(Inicio → Fin en una columna) estiradas hasta el borde derecho, acciones al pasar el ratón como en el
Journal (Editar naranja / Eliminar rojo) en filas de esquema y operación que abren los paneles correctos
sin plegar la fila, operaciones en 10 columnas sin scroll lateral, resultado sin borde, paginación ‹ ›
compacta. La disposición del teléfono no cambia hasta las tareas 2–3, como se esperaba.
