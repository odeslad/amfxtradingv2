# 027 — Un único campo de fecha · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + app local sobre la API de producción | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 3 | 2 |
| 2 [frontend] | build + lint + app local | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 1,5 | 0,5 |

## Evidencia

### Tarea 1

Build y lint limpios. Aceptada por el usuario el 27-10-2026 en la app local: tecleo de dígitos con
separadores en vivo en Apertura / Cierre de la operación e Inicio / Fin del esquema, borrado a través de los
separadores, pegar, fechas no válidas en rojo que bloquean el guardado, el calendario propio (desplegable
alineado a la derecha en la columna derecha del panel lateral, flechas de mes, Hoy, la hora se conserva al
elegir un día, cierre con Escape / clic fuera), esquemas y operaciones existentes mostrados en el formato
nuevo y guardados sin cambios, el panel inferior en el teléfono. El desplegable se pinta en `document.body`
mediante portal y se coloca midiéndolo, así el `overflow` de los paneles laterales nunca lo recorta.

### Tarea 2

Build y lint limpios. Aceptada por el usuario el 27-10-2026: Ends de la notificación EMA con `DateField`
(fecha y hora, guardado como antes), From / To del rango personalizado del Journal y de Stats con
`IsoDateField` (el filtro se aplica al completar la fecha, mismas filas que antes, los filtros reabiertos
muestran `DD/MM/YYYY`), panel inferior en el teléfono. Se quitó la regla `::-webkit-calendar-picker-indicator`
del selector nativo de las dos hojas de estilo de filtros; `.dateInput` se queda para quitar la flecha de
select del fondo.
