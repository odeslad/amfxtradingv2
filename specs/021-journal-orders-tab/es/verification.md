# 021 — Pestaña Orders en el Journal · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | manual (lectura; lo compila el pipeline en la tarea 7) | 🕐 | 0,5 | 0,25 |

## Tarea 1 — `modify` mueve una orden pendiente al precio recibido (ea)

- Rama `modify` de `HttpBridgeCommands.mq4`: tras `OrderSelect`, `isPending = OrderType() >= OP_BUYLIMIT` y `newPrice = (isPending && price > 0) ? price : OrderOpenPrice()`; `OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. `price` ya se extraía al principio de `ExecuteCommand` (línea 65), así que un `modify` sin él queda en 0 y conserva el precio de apertura; las posiciones de mercado (tipos 0 / 1) lo conservan lleve lo que lleve el comando. La línea de log OK imprime ahora el precio. Versión 2.22 en `#property version` y en el banner de arranque. `ea/docs/HttpBridgeCommands.md`: campo `price` y fila `modify` actualizados.
- Lectura: la rama sigue las convenciones `ExtractField` / `ResultError` / `ResultOk(-1, id)` de `close` y `modify`; una modificación rechazada (130 stops inválidos, 4107 precio inválido, 1 sin cambios) vuelve por `ResultError` como antes. La compilación ocurre en el VPS en el push de la tarea 7 (MetaEditor mediante `compile-ea.ps1`); 🕐 hasta que esa ejecución quede en verde.
- Est vs Real: 0,5 vs 0,25 SP.
