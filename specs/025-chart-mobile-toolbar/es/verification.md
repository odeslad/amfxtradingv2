# 025 — Arreglos del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [backend] | build + vitest + backend local | `npm run build` · `npm test` (103 tests, 4 nuevos en `candle-close.test.ts`) · `npm run lint` · backend local en el 3001, bridges apagados, BD de producción por el túnel → `/health` 200 | ✅ pasa | 1 | 0,75 |

## Evidencia

### Tarea 1

`tsc` y `eslint` limpios; toda la suite pasa. Los tests nuevos cubren el rastreador: el primer tick solo
siembra, los ticks con el mismo time no reportan nada, un `m5_time` avanzado cierra la vela M5 con la
apertura / máximo / mínimo del tick anterior y su bid como cierre, un cambio de hora cierra M5 / M15 / H1 a
la vez sin tocar otro símbolo ni broker, y un tick sin time de vela se salta. La ruta del rollover en sí
(upsert + emisión `candle`) necesita un pipe vivo, así que se comprueba en producción en la tarea 5.
