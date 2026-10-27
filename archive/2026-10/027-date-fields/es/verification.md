# 027 — Un único campo de fecha · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + app local sobre la API de producción | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 3 | 2 |
| 2 [frontend] | build + lint + app local | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 1,5 | 0,5 |
| 3 [infra] | manual (validación del usuario en producción) | push `536a4fd..7085f77`, "Deploy Frontend to VPS" en verde | ✅ pasa | 0,5 | 0,5 |
| 4 [specs] | manual | este fichero, `Estado: cerrada`, `git mv` a `archive/2026-10/` | ✅ pasa | 0,25 | 0,25 |

**Total**: Est 5,25 SP · Real 3,25 SP. Calibración: el calendario y su colocación llevaron lo previsto; migrar
los formularios fue más barato de lo estimado porque cada uno conservó su forma de valor y solo cambió el
input.

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

### Tarea 3

Push `536a4fd..7085f77`; "Deploy Frontend to VPS" correcto y producción sirvió el bundle nuevo. Validada por
el usuario en producción el 27-10-2026 contra los CA 1–8. Al revisarla, el usuario vio que las pestañas de
año de la página de esquemas (spec 026) no escalan con más años; eso va a una spec de seguimiento.

### Tarea 4

Cerrada y archivada en `archive/2026-10/`.
