# 011 — Vitalidad de la fila de Cuentas · Diseño

## Enfoque

`daily-pnl` en `routes/balances.ts` salta los brokers cuya entrada de vitalidad dice que el pipe no está conectado. La comprobación es un helper puro pequeño en `store/liveness.ts`, `isPipeLive(state)`, verdadero para `connected` y `disabled`, de modo que se testea unitariamente con el resto del store. Sin cambios de esquema, WS ni frontend.

## Cambios

- `store/liveness.ts`: `isPipeLive(pipe)` → `pipe === 'connected' || pipe === 'disabled'`; `pipeStateOf(broker)` → el estado registrado o `null` (un broker no registrado se trata como vivo, así cualquier camino inesperado queda inocuo).
- `routes/balances.ts`: en el bucle de `daily-pnl`, saltar el broker cuando `!isPipeLive(pipeStateOf(broker) ?? 'connected')`.
- `store/liveness.test.ts`: casos para `isPipeLive` y `pipeStateOf`.

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/src/store/liveness.ts` | `isPipeLive`, `pipeStateOf` |
| `backend/src/store/liveness.test.ts` | tests |
| `backend/src/routes/balances.ts` | saltar brokers no vivos en `daily-pnl` |

## Riesgos

- Un broker con el pipe en `error` (reintentando) también se omite — correcto: ningún EA lo alimenta.
- Ninguno para los brokers conectados: el cuerpo del bucle no cambia.
