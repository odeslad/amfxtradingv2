# 024 — Ocultar brokers y símbolos desde Settings · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` contra producción | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <producción vía túnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pasa | 0,25 | 0,25 |
| 2 [backend] | build + backend local contra producción | `npm run build` · backend local (`PORT=3001`, bridges apagados, BD por el túnel) · script llamando a `GET` / `PUT /settings` con un JWT forjado | ✅ pasa | 0,5 | 0,5 |
| 3 [frontend] | build + lint + app local | `npm run build` · `npm run lint` · Vite en el 5174 con proxy al backend local (3001, BD de producción por el túnel) | ✅ pasa | 2 | 1,5 |
| 4 [frontend] | build + lint + app local | `npm run build` · `npm run lint` · mismo stack local que la tarea 3 | ✅ pasa | 1,5 | 1 |

## Evidencia

### Tarea 1

`prisma generate` y `tsc` limpios. El diff contra la base de datos de producción imprime exactamente las
dos columnas de `20261025000000_visibility`:

```
ALTER TABLE "settings_display" ADD COLUMN "hiddenBrokers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hiddenSymbols" JSONB NOT NULL DEFAULT '{}';
```

### Tarea 2

La migración se aplicó a producción por el túnel (`prisma migrate deploy`, columnas aditivas con valores
por defecto) para que el backend local corriera contra ella; el `migrate deploy` del despliegue ya no hace nada.

```
GET antes              200 {"hiddenBrokers":[],"hiddenSymbols":{}}
PUT forma incorrecta   400 {"error":"visibility.hiddenBrokers must be an array"}
PUT set                200 {"hiddenBrokers":["GhostBroker"],"hiddenSymbols":{"GhostBroker":["EURUSD","GBPUSD"]}}
GET después            200 (igual)
PUT sin visibility     200 (igual, intacto)
restaurado             200 {"hiddenBrokers":[],"hiddenSymbols":{}}
```

Duplicados eliminados, símbolos en mayúsculas, lista vacía descartada, broker desconocido conservado (CA 2).

### Tarea 3

Build y lint limpios (un arreglo de lint: el buscador se vacía al cerrar en vez de en un efecto). Comprobado
por el usuario en la app local el 23-10-2026: tabla y toggles de la pestaña Visibility, panel Symbols con
buscador, Show all / Hide all y filas con casilla, Save seguido de recarga conservando lo oculto, filas de
móvil en ventana estrecha. Layout móvil ajustado a petición del usuario: el botón Symbols va en la misma
fila que el toggle en vez de a ancho completo debajo. La comprobación en iPhone queda para la validación en
producción (tarea 5). Detalle de desarrollo anotado: Vite debe arrancarse desde PowerShell, Git Bash
reescribe `VITE_API_BASE=/__api` como ruta de Windows y la app carga en blanco.

### Tarea 4

Build y lint limpios. Validado por el usuario en la app local el 23-10-2026 con un broker y símbolos
ocultos: filas y opciones de filtro de Accounts / Positions / Orders / History, selectores y panel de
filtros del gráfico con la selección oculta marcada "· hidden", listas manuales de New Trade (mirror sin
tocar), selector de broker de Stats, select de broker y chips del panel de notificaciones; Mirror, Devices,
alertas y toasts sin cambios; volver a mostrar el broker recupera las filas sin recargar. Los efectos de
carga del gráfico leen la visibilidad por una ref para que guardar no vuelva a pedir las listas.
