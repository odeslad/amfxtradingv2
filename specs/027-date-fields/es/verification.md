# 027 — Un único campo de fecha · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + app local sobre la API de producción | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa | 3 | 2 |

## Evidencia

### Tarea 1

Build y lint limpios. Aceptada por el usuario el 27-10-2026 en la app local: tecleo de dígitos con
separadores en vivo en Apertura / Cierre de la operación e Inicio / Fin del esquema, borrado a través de los
separadores, pegar, fechas no válidas en rojo que bloquean el guardado, el calendario propio (desplegable
alineado a la derecha en la columna derecha del panel lateral, flechas de mes, Hoy, la hora se conserva al
elegir un día, cierre con Escape / clic fuera), esquemas y operaciones existentes mostrados en el formato
nuevo y guardados sin cambios, el panel inferior en el teléfono. El desplegable se pinta en `document.body`
mediante portal y se coloca midiéndolo, así el `overflow` de los paneles laterales nunca lo recorta.
