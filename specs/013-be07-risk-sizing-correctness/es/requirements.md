# 013 · BE-07 — Corrección del sizing por % de riesgo

> Status: **draft**
> Origin: [auditoría backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 7 (diagnóstico F)

## Contexto

Cuando se envía una orden con `lotsMode: "risk_pct"`, `POST /commands` convierte "arriesga N % del balance con este stop loss" en lotes mediante `services/sizing.ts`. Tres comportamientos producen un tamaño erróneo sin avisar al usuario:

- La distancia al stop se mide siempre desde el **bid actual**, incluso en órdenes pendientes (`buylimit`, `sellstop`, …) que llevan su propio `price` de entrada. Una orden limitada colocada lejos del mercado se dimensiona para una distancia de stop que nunca tendrá.
- Cuando la divisa cotizada difiere de la de la cuenta y no hay par de conversión con ticks (`COTCUE` o `CUECOT`), el valor del pip se usa **sin convertir**. En un par cotizado en JPY con cuenta EUR eso es un valor de pip ~160 veces mayor (lotes 160 veces menores); en otros cruces el error puede ir al revés.
- Todo lo que no sea un par forex de 6 letras (oro, índices, cripto) se dimensiona con contrato de 100 000 y pip de 0,0001, lo que no tiene sentido para esos instrumentos.

El tamaño del pip además se deriva con `symbol.includes('JPY')` en vez del `getPipSize` compartido que usan el scanner y las alertas. La spec 008 añadió tests de caracterización del comportamiento actual, incluido el fallback silencioso como "límite documentado"; esta spec sustituye ese límite por un rechazo explícito.

## Capas afectadas

- backend

Sin cambios en frontend: el panel ya muestra el texto `error` de una respuesta 400/503 de `POST /commands`.

## Historias de usuario

- Como usuario, quiero que una orden pendiente por % de riesgo se dimensione desde su precio de entrada, para que el dinero en riesgo sea el porcentaje que pedí.
- Como usuario, quiero que la orden se rechace con un mensaje claro cuando el backend no pueda calcular un tamaño fiable, para no enviar nunca una posición dimensionada sobre una suposición errónea.

## Criterios de aceptación

- AC 1. CUANDO un comando por % de riesgo lleva `price` (orden pendiente) ENTONCES la distancia al stop es `|price − sl|`; CUANDO no lo lleva (orden a mercado) ENTONCES es `|bid − sl|` como hoy.
- AC 2. CUANDO la divisa cotizada es la de la cuenta ENTONCES el resultado no cambia respecto a hoy. CUANDO hay un par de conversión con ticks (directo o inverso) ENTONCES el resultado no cambia respecto a hoy.
- AC 3. CUANDO la divisa cotizada difiere de la de la cuenta y ningún par de conversión tiene tick ENTONCES `POST /commands` responde `503 { error: "Cannot size EURJPY on a USD account: no JPYUSD or USDJPY price yet" }` (con el símbolo, la divisa de la cuenta y ambos nombres de par) y no se escribe nada en el bridge.
- AC 4. CUANDO el símbolo no es un par de dos divisas conocidas (primeras seis letras) ENTONCES `POST /commands` responde `400 { error: "Risk % sizing supports forex pairs only (got XAUUSD); use fixed lots" }` y no se escribe nada.
- AC 5. CUANDO la distancia al stop es cero ENTONCES `POST /commands` responde `400 { error: "SL must differ from the entry price" }` (hoy envía 0,01 lotes en silencio).
- AC 6. El tamaño del pip sale del `getPipSize` compartido; un símbolo con sufijo de broker (p. ej. `EURUSD.r`) se dimensiona por sus seis primeras letras.
- AC 7. Los comandos de lotes fijos (`lotsMode` ausente o `fixed`) no se tocan.

## Fuera de alcance

- Dimensionar instrumentos no forex (requiere tamaño de contrato y valor del tick desde el EA; spec candidata EA + backend).
- Usar el ask como entrada en compras a mercado (el spread es pequeño frente a la distancia al stop; sin cambios).
- Paso / mínimo / máximo de lote por broker (se sigue redondeando a 0,01 con suelo de 0,01).
