# 024 — Ocultar brokers y símbolos desde Settings · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` contra producción | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <producción vía túnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pasa | 0,25 | 0,25 |
| 2 [backend] | build + backend local contra producción | `npm run build` · backend local (`PORT=3001`, bridges apagados, BD por el túnel) · script llamando a `GET` / `PUT /settings` con un JWT forjado | ✅ pasa | 0,5 | 0,5 |

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
