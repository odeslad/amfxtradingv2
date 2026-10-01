# 004 · BE-01 — Frontera de errores y validación de peticiones

> Estado: **cerrada**
> Origen: [auditoría del backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 1 (diagnóstico A)

## Contexto

El backend es un único proceso Node (Express 4) que aloja el lector de pipe de cada broker, los watchers de archivos, los evaluadores de alertas, el WebSocket y la API HTTP. Express 4 no captura las promesas rechazadas de los handlers `async`, la app no tiene middleware de error y el proceso no tiene handler de `unhandledRejection`. En Node ≥ 15 un rechazo sin manejar termina el proceso, así que cualquier petición cuya llamada a Prisma lance — `GET /trades?limit=abc` (`take: NaN`), `?from=x` (Invalid Date), `GET /candles?before=x`, `PUT /chart-indicators` sin `emas`, `PUT /settings` con un `mirror` malformado, o cualquier error transitorio de la base de datos — reinicia el backend entero: ticks, posiciones en vivo, alertas armadas y resultados de comandos en curso se pierden durante varios segundos. El usuario ha confirmado reinicios esporádicos en producción. Hoy solo `stats`, `alerts`, `ema-alerts`, `setup-levels`, `scanner`, `drawings` y `push` validan su entrada; `trades`, `candles`, `positions/color`, `settings`, `chart-indicators` y `commands` pasan valores crudos a Prisma o al EA.

## Capas afectadas

- backend

## Historias de usuario

- Como operador, quiero que una petición malformada o fallida produzca una respuesta HTTP de error en lugar de reiniciar el backend, para que los precios, las alertas y las órdenes pendientes nunca se interrumpan por una mala petición.
- Como frontend, quiero que los parámetros inválidos se rechacen con `400` y un mensaje claro, para que los bugs de la UI aparezcan de inmediato en vez de como `500` o caídas silenciosas.
- Como operador, quiero que cada error inesperado quede registrado con método, ruta y stack, para poder encontrar la causa de un `500` en el log de pm2.

## Criterios de aceptación

- AC 1. CUANDO un handler `async` de ruta lanza o rechaza ENTONCES el cliente recibe `500 { "error": "Internal error" }`, el error se registra con método, ruta y stack, y el proceso sigue en marcha.
- AC 2. CUANDO una promesa se rechaza en cualquier punto del proceso sin handler ENTONCES se registra con prefijo `[UNHANDLED]` y el proceso sigue en marcha.
- AC 3. CUANDO `GET /trades` recibe `limit` u `offset` que no es un entero no negativo, o `from`/`to` que no es una fecha parseable ENTONCES responde `400` con un mensaje que nombra el parámetro. Los valores válidos conservan el comportamiento actual (`limit` tope 1000, por defecto 200; `offset` por defecto 0).
- AC 4. CUANDO `GET /candles` recibe `limit`, `before` o `after` que no es un entero positivo (segundos epoch para `before`/`after`) ENTONCES responde `400`. Los valores válidos conservan el comportamiento actual (`limit` tope 5000, por defecto 500).
- AC 5. CUANDO `GET /candles/emas` recibe `emaFast` o `emaSlow` que no es un entero positivo, o `from`/`to` que no es un entero positivo ENTONCES responde `400`.
- AC 6. CUANDO `PATCH /positions/color` recibe un `ticket` que no es entero o un `color` que no es string ENTONCES responde `400`.
- AC 7. CUANDO `PUT /settings` recibe un item de `mirror` sin `broker` string no vacío, `enabled` booleano, `lotsMode` en `"fixed"` o `"risk_pct"` y `lots` finito positivo, o un `display` sin `pnlMode` en `net | gross | pips | pct`, un `trendlineStyle` presente pero fuera de `solid | dashed | dotted`, un `trendlineColor` presente pero no string, o un `trendlineWidth` presente pero no entero positivo ENTONCES responde `400` y no escribe nada.
- AC 8. CUANDO `PUT /chart-indicators` recibe un `emas` que no es array ENTONCES responde `400`.
- AC 9. CUANDO `PUT /alerts/:id` o `PUT /ema-alerts/:id` recibe un campo con tipo o valor inválido (mismas reglas que el `POST` correspondiente, aplicadas solo a los campos presentes) ENTONCES responde `400` y no actualiza nada.
- AC 10. CUANDO `POST /commands` recibe una `action` fuera de `buy, sell, buylimit, selllimit, buystop, sellstop, close, modify`, un `lots` que no es número finito positivo cuando `lotsMode` no es `risk_pct`, un `sl`/`tp`/`price` presente pero no numérico finito, un `ticket` presente pero no entero, o un `id` que no cumple `^[A-Za-z0-9_-]{1,64}$` ENTONCES responde `400` y no se escribe nada en `command.json`.
- AC 11. CUANDO un parámetro de query que debe ser único se repite (`?broker=a&broker=b`) ENTONCES responde `400` en lugar de recibir un array.
- AC 12. CUANDO se envía contra producción cada petición de la lista de humo manual de `tasks.md` ENTONCES cada una devuelve el estado documentado y `pm2 list` no muestra ningún reinicio de `amfxtrading-backend` durante la prueba.
- AC 13. CUANDO se repiten todas las peticiones válidas que usa hoy el frontend ENTONCES sus respuestas son idénticas byte a byte a las de antes del cambio (sin cambio de comportamiento para entrada válida).

## Fuera de alcance

- Límite de intentos de login, arreglo de la cookie de logout, login con tiempo constante (spec 005).
- Comprobación de origen del WebSocket, heartbeat, entrega por usuario (mejora 5 de la auditoría).
- Timeouts de comandos, escritura atómica de `command.json`, `pending.json`, resultados tardíos (mejora 6) — esta spec solo valida el cuerpo del comando.
- Corrección del sizing (mejora 7).
- Acotar el histórico de `GET /candles/emas` (mejora 9) — esta spec solo valida sus parámetros.
- Migrar a Express 5 (manejo nativo de errores async); el envoltorio que se introduce aquí pasa a ser eliminable cuando ocurra.
- Añadir una librería de validación (zod/valibot): el puñado de comprobaciones necesarias se escribe como pequeños helpers tipados sin dependencia nueva.
