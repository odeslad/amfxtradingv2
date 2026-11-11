# 041 — Suscripción de ticks por WebSocket

> Status: **approved**

## Contexto

El backend emite cada lote de ticks de cada broker a todos los clientes WebSocket. Medido en producción el 2026-11-10 (12:55 UTC, 11 brokers conectados, 74 pares broker/símbolo): un frontend abierto recibe ~320 KB/s (≈ 2,5 Mbit/s, ≈ 1,15 GB por hora), y el 98 % de ese volumen son mensajes `ticks`. El frontend solo usa los ticks de los pares broker/símbolo que tiene en pantalla: la vela viva de cada slot de chart (uno o dos en vista dividida), el precio del panel de alertas y el bid/ask del panel New Trade. Todo lo demás se parsea y se descarta. Con datos móviles, una tarde con la app abierta cuesta varios GB.

El broker solo se selecciona en el chart. Accounts, Positions y Orders muestran todos los brokers a la vez, pero no leen `ticks`: Accounts usa el mensaje `account` y Positions / Orders el mensaje `positions`, que ya lleva el bid/ask actual de cada posición (inyectado por el backend cada segundo). Esas páginas siguen funcionando sin ninguna suscripción.

Esta spec hace el flujo de ticks por cliente: el frontend indica al backend qué pares broker/símbolo necesita y el backend solo envía esos. `positions`, `account`, `candle`, `trades_updated`, `command_result`, `alert` y `ema_alert` mantienen su comportamiento actual.

## Capas afectadas

- backend · frontend

## Historias de usuario

- Como trader con conexión móvil, quiero que la app descargue solo los precios de los charts que estoy mirando, para que tenerla abierta no se coma mi tarifa de datos.
- Como trader, quiero que el chart, el panel de alertas y el panel New Trade sigan actualizándose en vivo exactamente como hoy, para que el ahorro me resulte invisible.
- Como operador del VPS, quiero que el backend envíe menos bytes por cliente, para que más dispositivos abiertos no saturen la subida.

## Criterios de aceptación

- AC 1. CUANDO un cliente WebSocket se conecta ENTONCES no recibe mensajes `ticks` hasta que haya enviado una suscripción.
- AC 2. CUANDO un cliente envía una suscripción con un conjunto de pares broker/símbolo ENTONCES desde ese momento recibe mensajes `ticks` que contienen solo ticks de esos pares; un lote sin ningún tick coincidente no se envía a ese cliente.
- AC 3. CUANDO un cliente envía una nueva suscripción ENTONCES sustituye por completo al conjunto anterior (un conjunto vacío detiene los ticks).
- AC 4. CUANDO el conjunto de pares que necesita el frontend cambia (selección del chart, vista dividida, panel New Trade abierto con otro broker, panel cerrado) ENTONCES envía el nuevo conjunto dentro de un intervalo de tick, y los componentes que dependen de él siguen actualizándose en vivo sin hueco visible.
- AC 5. CUANDO el WebSocket se reconecta ENTONCES el frontend reenvía su conjunto actual antes de que ningún componente note una actualización perdida.
- AC 6. CUANDO un cliente envía una suscripción mal formada (forma incorrecta, tipo desconocido, tamaño excesivo) ENTONCES el backend la ignora y mantiene el conjunto anterior; un cliente que inunda con suscripciones se trata como hoy a un cliente lento (se salta, luego se termina) en lugar de tumbar el proceso.
- AC 7. CUANDO el script de medición del 2026-11-10 se vuelve a ejecutar contra el backend desplegado con una suscripción de un par broker/símbolo ENTONCES el volumen recibido está por debajo del 5 % del volumen sin suscripción (≈ 16 KB/s o menos con la misma actividad de mercado).
- AC 8. CUANDO se emiten `positions`, `account`, `candle`, `trades_updated`, `command_result`, `alert` o `ema_alert` ENTONCES llegan a los clientes exactamente como antes, independientemente de la suscripción de ticks; Accounts, Positions y Orders siguen mostrando todos los brokers en vivo sin suscripción.
- AC 9. CUANDO se conecta un cliente que nunca se suscribe (un build antiguo del frontend aún en caché) ENTONCES simplemente no recibe ticks y el resto de la app funciona; el deploy del frontend sigue al del backend como siempre.

## Fuera de alcance

- Comprimir el WebSocket (`permessage-deflate`).
- Adelgazar el payload del tick (campos OHLC por timeframe) o limitar la frecuencia de ticks.
- Suscripciones para otros tipos de mensaje (posiciones y cuenta siguen por broker como hoy).
- Uso en servidor de `hiddenBrokers` / `hiddenSymbols` (la visibilidad sigue siendo cosa del frontend).
