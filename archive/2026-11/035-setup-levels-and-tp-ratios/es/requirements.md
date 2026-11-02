# 035 — Setup levels en modo mirror, visibilidad de niveles y atajos de TP por ratio

> Status: **closed**

## Contexto

New Trade muestra el panel Setup levels (ECC / EMA / EVL / MHL, de `GET /setup-levels`) solo en modo manual: el panel, su selector de timeframe y la carga de niveles dependen de `mode === 'manual'`, así que el operador que envía una orden mirror (spec 033) pierde los niveles justo al colocar las órdenes más importantes. El panel lista siempre los cuatro niveles, sin forma de ocultar los que el operador no usa. SL y TP son inputs planos: al pulsar un nivel se rellena el SL, pero el TP hay que teclearlo a mano en New Trade y en Edit group, aunque el operador casi siempre lo coloca a un ratio riesgo/beneficio fijo.

## Capas afectadas

- db · backend · frontend

## Historias de usuario

- Como operador, quiero el panel Setup levels también en modo mirror, para colocar una orden mirror sobre el setup actual sin cambiar a manual para leer los niveles.
- Como operador, quiero elegir en Settings › Display qué niveles de setup se listan, para que el panel muestre solo los niveles que opero.
- Como operador, quiero botones 2:1 y 3:1 junto al campo TP, para que el TP se calcule desde la entrada y el SL sin calculadora.

## Criterios de aceptación

### Setup levels en modo mirror

- AC 1. CUANDO New Trade está en modo mirror con un símbolo seleccionado ENTONCES se muestran el selector Setup timeframe y el panel Setup levels exactamente igual que en manual (mismas filas, bid en vivo, distancias en pips, clic en un nivel rellena el SL).
- AC 2. CUANDO se cargan los niveles en modo mirror ENTONCES se calculan para el broker del gráfico si está habilitado en el preset seleccionado; si no, para el primer broker habilitado del preset; cambiar de preset o de símbolo recarga.
- AC 3. CUANDO el preset seleccionado no tiene ningún broker habilitado ENTONCES el panel no se muestra (se mantiene el aviso actual).

### Visibilidad de niveles en Settings › Display

- AC 4. CUANDO el operador abre Settings › Display ENTONCES un grupo "Setup levels" lista ECC, EMA, EVL y MHL, cada uno con un interruptor, todos activos por defecto.
- AC 5. CUANDO un nivel se desactiva ENTONCES desaparece del panel Setup levels en New Trade (manual y mirror) en todos los dispositivos, persistido con el resto de ajustes de display (`PUT /settings`, `SettingsDisplay`).
- AC 6. CUANDO todos los niveles están desactivados ENTONCES el panel Setup levels y su selector de timeframe se ocultan en New Trade.

### Atajos de TP por ratio

- AC 7. CUANDO el campo TP de New Trade está en modo precio (el input de hoy) ENTONCES dos botones `2:1` y `3:1` junto a él pasan el campo a **modo ratio**: el campo muestra el ratio elegido y el precio resultante, `TP = entrada ± R × ratio`, con `R = |entrada − SL|`, `+` para el lado buy y `−` para el lado sell, redondeado a la precisión del símbolo.
- AC 8. CUANDO la orden es a mercado ENTONCES la entrada es el precio actual de ese lado (ask para buy, bid para sell); CUANDO es pendiente ENTONCES la entrada es el precio tecleado en el campo Price.
- AC 9. CUANDO el campo está en modo ratio y el SL está vacío o no es válido, o una orden pendiente no tiene precio ENTONCES el campo muestra el ratio sin precio y la orden no se puede enviar hasta que exista SL (y precio).
- AC 10. CUANDO el campo está en modo ratio y el operador edita el SL, el Price, el lado o el símbolo, o llega un tick nuevo ENTONCES el precio resultante mostrado se actualiza y la orden envía el TP calculado en el momento del envío; CUANDO el operador pulsa la ✕ del campo ENTONCES vuelve a modo precio, vacío.
- AC 11. CUANDO el panel Edit group está abierto ENTONCES su campo TP tiene los mismos dos modos: en modo ratio el TP se calcula por posición desde su precio de apertura y su SL efectivo (el SL tecleado en el panel si lo hay; si no, el SL actual de la posición); las posiciones sin SL efectivo conservan su TP.
- AC 12. CUANDO Edit group está en modo ratio ENTONCES el campo muestra el ratio y el precio resultante si todas las posiciones reciben el mismo TP; si no, solo el ratio, con una lista de previsualización por posición; el envío manda un `modify` por posición con su propio TP.
- AC 13. CUANDO el operador pulsa ✕ en Edit group ENTONCES el campo vuelve a modo precio, vacío, y un valor tecleado se aplica a todas las posiciones, como hoy.

## Fuera de alcance

- Otros ratios o un input de ratio personalizado (solo 2:1 y 3:1).
- Atajos de ratio en el editor de órdenes pendientes o en el arrastre del gráfico.
- Cambiar cómo se calculan los niveles (`indicators/ema-cross.ts`), los periodos de EMA o el EA.
- Visibilidad de niveles por broker, por símbolo o por dispositivo (un único ajuste global, como el resto de ajustes de display).
