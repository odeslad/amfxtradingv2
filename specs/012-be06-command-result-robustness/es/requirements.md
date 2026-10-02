# 012 · BE-06 — Robustez del resultado de comandos

> Status: **draft**
> Origin: [auditoría backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 6 (diagnóstico F)

## Contexto

Una orden viaja web → `POST /commands` → `bridge/command.json` → EA (sondea cada segundo) → MT4 → `bridge/result.json` → backend → WS `command_result` → web. La spec 004 ya añadió la validación de entrada que pedía la auditoría (lista blanca de acciones, lotes finitos positivos, ticket numérico, charset del `id`), así que los 400 ya están. Queda la segunda mitad del punto de auditoría, el único sitio del sistema donde un fallo cuesta dinero:

- `command.json` se escribe en el sitio: el EA puede leer un fichero a medio escribir.
- El backend espera 10 s fijos a `result.json` y después informa `timeout` ("No response from EA") y deja de escuchar. El EA escribe `pending.json` en cuanto empieza a ejecutar, y un cierre puede reintentar hasta cinco veces — un resultado a los 12 s se escribe, nadie lo lee, y el usuario ve "sin respuesta" para una orden que sí se ejecutó. El siguiente comando encuentra un `result.json` obsoleto con otro id y lo ignora, lo que esconde el resultado tardío para siempre.
- El `message` de error del EA (p. ej. `ticket not found`) se descarta; la web solo recibe `EA error (code 130)` o `EA error`.

## Capas afectadas

- backend

Sin cambios en frontend: `command_result` conserva `{ id, status, ticket?, error? }`; un resultado tardío reutiliza el estado real (`ok`/`error`) con una marca extra `late: true` que la UI actual ignora (muestra "Order executed — ticket #" / el toast de error, que es el resultado correcto). Sin cambios en el EA: los formatos de `command.json`, `pending.json` y `result.json` se mantienen como documenta `ea/docs/HttpBridgeCommands.md`.

## Historias de usuario

- Como usuario, quiero que "No response from EA" signifique que el EA de verdad no respondió, para no repetir nunca una orden que sí se ejecutó.
- Como usuario, quiero el mensaje de error del EA en el toast, para saber *por qué* se rechazó una orden sin abrir MT4.
- Como operador, quiero que un resultado tardío quede en el log con su id, para poder conciliar un timeout con lo que hizo MT4.

## Criterios de aceptación

- AC 1. CUANDO se escribe un comando ENTONCES se escribe en `command.tmp` y se renombra a `command.json` en un solo paso; el EA nunca ve un fichero parcial.
- AC 2. CUANDO `result.json` con el `id` del comando aparece en menos de 10 s ENTONCES el resultado se emite como hoy (`ok` con ticket, o `error`).
- AC 3. CUANDO pasan los 10 s pero existe `pending.json` con el mismo `id` ENTONCES la espera se alarga, hasta 30 s en total desde la escritura, mientras ese `pending.json` esté presente.
- AC 4. CUANDO la espera expira sin resultado ENTONCES se emite `command_result` `{ status: "timeout", error: "No response from EA" }` como hoy, **y** el backend sigue vigilando `result.json` para ese `id` durante 60 s más en segundo plano sin bloquear la cola del broker.
- AC 5. CUANDO el resultado de ese `id` aparece durante la ventana en segundo plano ENTONCES se emite como `command_result` con su `status`, `ticket` y `error` reales, más `late: true`, y se registra como `[CMD:<broker>] late result id=… status=…`. El fichero se elimina como siempre.
- AC 6. CUANDO `result.json` trae `message` ENTONCES el `error` emitido es `EA error: <message>` (con `(code N)` añadido si hay `code`); CUANDO solo trae `code` ENTONCES `EA error (code N)` como hoy.
- AC 7. CUANDO arranca el siguiente comando de la misma cola de broker ENTONCES un `result.json` obsoleto con otro `id` se elimina y se registra una vez (`[CMD:<broker>] discarding stale result id=…`) en vez de sondearse en silencio.
- AC 8. La respuesta 202, la cola por broker (un comando a la vez por broker) y todas las respuestas 400/404/503 existentes no cambian.

## Fuera de alcance

- Cambiar el EA (formatos, reintentos, el sondeo de 1 s).
- Una UI de "resultado tardío" en el frontend (los toasts actuales ya se leen bien); persistir el historial de comandos en BD.
- Cambios de sizing (BE-07, spec aparte).
