# 009 · BE-05 — Endurecimiento del WebSocket

> Status: **draft**
> Origin: [auditoría backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 5 (diagnóstico D)

## Contexto

El backend expone `/ws` para el feed en tiempo real (ticks, posiciones, cuenta, resultados de comandos, alertas de precio y de cruce de EMAs). Hoy el socket se acepta primero y la cookie JWT se comprueba después, en el handler `connection`, que cierra con código 1008 si falta o no es válida. La cabecera `Origin` no se comprueba nunca, y la cookie de sesión se emite con `SameSite=None` para `.amfxtrading.com`: cualquier página abierta en el navegador del usuario puede abrir `/ws` y leer todo el feed (*cross-site WebSocket hijacking*). No hay ping/pong, así que un cliente cuya conexión TCP murió en silencio (portátil cerrado, cambio de red del móvil) sigue en `wss.clients` y sigue recibiendo escrituras que se acumulan sin límite en su buffer de envío; lo mismo con una pestaña que el navegador ha congelado. Y todos los mensajes van a todos los clientes: las alertas de precio y de EMA llevan el `userId` del dueño y el frontend descarta las que no son suyas, de modo que un segundo usuario vería por el cable las alertas del primero.

La API REST ya tiene una lista de orígenes permitidos para CORS (`app.ts`, `*.amfxtrading.com` con puerto opcional, que cubre también el host HTTPS de desarrollo local); el WS debe aplicar la misma regla.

## Capas afectadas

- backend

Sin cambios en frontend: el cliente ya reconecta al cerrarse y ya filtra las alertas por `userId`; esos campos se mantienen en los mensajes.

## Historias de usuario

- Como único usuario de la plataforma, quiero que una página de otro sitio no pueda abrir mi feed en tiempo real con mi cookie de sesión, para que mis precios, posiciones y cuenta sigan siendo privados aunque navegue por un sitio hostil.
- Como operador, quiero que los clientes muertos o congelados se descarten en menos de un minuto, para que la memoria del backend no crezca con sockets obsoletos entre reinicios de pm2.
- Como usuario, quiero que mis alertas de precio y de EMA lleguen solo a mis propias sesiones, para que otra cuenta del mismo backend nunca las reciba.

## Criterios de aceptación

- AC 1. CUANDO una petición de upgrade a `/ws` lleva un `Origin` fuera de la lista permitida ENTONCES el servidor responde `403` y no se crea ningún WebSocket (no se registra ninguna conexión de cliente).
- AC 2. CUANDO una petición de upgrade a `/ws` no lleva cookie `token` válida ENTONCES el servidor responde `401` y no se crea ningún WebSocket.
- AC 3. CUANDO el upgrade supera ambas comprobaciones ENTONCES el socket se crea con el `userId` del JWT asociado.
- AC 4. CUANDO un cliente conectado no responde a un ping dentro del intervalo de latido (30 s) ENTONCES el servidor lo termina y desaparece del recuento de clientes; un cliente sano nunca es descartado por el latido.
- AC 5. CUANDO el buffer de envío de un cliente supera 1 MB ENTONCES los broadcasts lo saltan (el socket sigue abierto); CUANDO supera 8 MB ENTONCES el servidor lo termina. Un cliente que lee con normalidad nunca alcanza ninguno de los dos umbrales.
- AC 6. CUANDO se dispara una alerta de precio o de cruce de EMAs del usuario U ENTONCES solo los sockets cuyo `userId` es U reciben `alert` / `ema_alert`; ticks, posiciones, cuenta y `command_result` siguen llegando a todos los clientes autenticados.
- AC 7. CUANDO el frontend en producción y en desarrollo local (proxy de Vite, `local.amfxtrading.com`) se conecta ENTONCES sigue recibiendo ticks, posiciones, cuenta y alertas exactamente como hoy, también tras una reconexión.
- AC 8. CUANDO el proceso recibe `SIGTERM` ENTONCES se limpia el intervalo del latido y se cierra el servidor WebSocket antes que el HTTP (ningún temporizador suelto mantiene vivo el proceso).

## Fuera de alcance

- Suscripciones por broker o por página (cada cliente sigue recibiendo el feed de todos los brokers).
- Cambiar la política de reconexión del frontend (reintenta cada 3 s incluso sin sesión; igual que hoy).
- Consumo de `ema_alert` en el frontend (se emite, nadie lo escucha; auditoría BE-10 / de frontend).
- Cambios en el esquema de mensajes: todas las cargas conservan su forma actual.
