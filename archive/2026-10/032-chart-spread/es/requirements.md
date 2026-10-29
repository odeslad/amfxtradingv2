# 032 — Spread en el gráfico (líneas ASK y BID)

> Estado: **cerrada**

## Contexto
El gráfico construye las velas y la línea de precio actual solo con el bid. El EA ya envía `bid` y `ask` en cada tick, y el backend reenvía el lote de ticks al frontend por WS sin cambios, pero el gráfico ignora el `ask`. El operador quiere ver el spread: un ajuste de visualización opcional que sustituya la línea de precio actual por dos líneas, ASK y BID.

## Capas afectadas
- db · backend · frontend

## Historias de usuario
- Como operador, quiero activar la opción "Mostrar spread" en Settings, para que el gráfico muestre dónde compraría (ask) y dónde vendería (bid).
- Como operador, quiero que la opción venga desactivada, para que el gráfico siga como está hasta que yo decida lo contrario.

## Criterios de aceptación
- CA 1. CUANDO la opción está desactivada ENTONCES el gráfico muestra la línea de precio actual como hoy (bid).
- CA 2. CUANDO la opción está activada ENTONCES el gráfico muestra dos líneas horizontales, ASK y BID, cada una con su etiqueta de precio en el eje, y ninguna otra línea de precio actual.
- CA 3. CUANDO llega un tick nuevo ENTONCES las dos líneas se mueven al `ask` y al `bid` del tick del símbolo del gráfico.
- CA 4. CUANDO se cambia la opción en Settings ENTONCES se guarda de forma global (como el resto de ajustes de visualización) y se aplica en escritorio y en móvil.
- CA 5. CUANDO todavía no ha llegado ningún tick con `ask` ENTONCES el gráfico muestra solo la línea BID (desde el cierre de la última vela) y ninguna línea ASK.
- CA 6. Las velas se siguen construyendo con el bid; la opción solo cambia las líneas.

## Fuera de alcance
- Valor del spread en pips como etiqueta o indicador aparte.
- Velas construidas con el ask.
- Spread en Positions, Orders o New Trade.
- Cambios en el EA o en el contrato de ticks.
