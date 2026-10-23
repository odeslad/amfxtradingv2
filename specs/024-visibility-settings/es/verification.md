# 024 — Ocultar brokers y símbolos desde Settings · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` contra producción | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <producción vía túnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pasa | 0,25 | 0,25 |

## Evidencia

### Tarea 1

`prisma generate` y `tsc` limpios. El diff contra la base de datos de producción imprime exactamente las
dos columnas de `20261025000000_visibility`:

```
ALTER TABLE "settings_display" ADD COLUMN "hiddenBrokers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hiddenSymbols" JSONB NOT NULL DEFAULT '{}';
```
