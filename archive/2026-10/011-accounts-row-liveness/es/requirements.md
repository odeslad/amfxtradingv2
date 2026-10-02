# 011 — La fila de Cuentas se pone gris cuando el EA está desconectado

> Status: **closed**
> Seguimiento de [010 · BE-08 — Vitalidad por broker](../../../archive/2026-10/010-be08-broker-liveness/es/requirements.md) (sin código de auditoría: detectado durante su validación en producción).

## Contexto

En la tabla de Cuentas del Journal una fila de broker se pone gris (`inactiveRow`, Day P&L `—`) cuando `GET /balances/daily-pnl` no trae entrada para él. Ese endpoint recorre el store de posiciones en memoria, que conserva la última entrada de todo broker que haya enviado posiciones desde que arrancó el backend. Así que "gris" significa en realidad "no visto desde el arranque": un EA que se para después mantiene su fila blanca y un Day P&L que ya no se mueve. La spec 010 lo validó en producción: se quitó el EA de Darwinex un minuto, `/health` lo marcó `listening`, la fila siguió blanca.

## Capas afectadas

- backend (el frontend ya pinta el estado gris; no cambia)

## Historias de usuario

- Como usuario, quiero que un broker cuyo EA no está conectado aparezca como inactivo en la tabla de Cuentas en segundos, para que un terminal muerto sea visible donde miro cada día.

## Criterios de aceptación

- AC 1. CUANDO el estado del pipe de un broker no es `connected` ENTONCES `GET /balances/daily-pnl` omite ese broker, y la fila de Cuentas se pone gris en el siguiente poll (≤ 5 s).
- AC 2. CUANDO el EA reconecta ENTONCES el broker reaparece en `daily-pnl` en el siguiente poll y la fila vuelve a la normalidad.
- AC 3. CUANDO el pipe está `disabled` (desarrollo local, `FEATURE_PIPE=false`) ENTONCES el broker se trata como conectado a estos efectos (comportamiento sin cambios en local).
- AC 4. Los brokers conectados conservan exactamente los valores de Day P&L de hoy.

## Fuera de alcance

- Leer `/health` desde el frontend (punto + antigüedad del tick por broker) — candidato para la auditoría de frontend.
- Tratar un tick obsoleto (> 5 min, mercado cerrado) como inactivo: un EA conectado en fin de semana mantiene su fila blanca.
