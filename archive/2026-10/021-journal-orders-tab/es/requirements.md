# 021 — Pestaña Orders en el Journal

> Estado: **cerrada**

## Contexto

El Journal tiene tres pestañas: Accounts, Positions e History. Las órdenes pendientes (buy / sell limit y
stop) no tienen sitio propio: viven como una sección "Pending Orders" al pie de Positions, comparten su
filtro (broker, símbolo, buy / sell, color) y su panel de edición, que solo cambia SL y TP. El `modify`
del EA mantiene el precio de la orden (`OrderModify(ticket, OrderOpenPrice(), sl, tp)`), así que el precio
de una orden colocada no se puede cambiar desde la web; el backend ya acepta y reenvía un `price` en el
`modify`, el EA simplemente lo ignora. Las acciones de grupo de Positions (Edit / Close de un grupo del
mismo símbolo y tipo) excluyen las órdenes pendientes.

Esta spec da a las órdenes su propia pestaña, con su propio filtro, su propio panel de edición (precio,
SL, TP) y un Edit / Cancel común para todas las órdenes listadas.

## Capas afectadas

- frontend · ea (en backend solo documentación)

## Historias de usuario

- Como operador, quiero una pestaña **Orders** junto a Positions, para que las órdenes pendientes dejen
  de mezclarse con las posiciones abiertas y vea de un vistazo qué hay colocado y dónde.
- Como operador, quiero filtrar las órdenes por broker, símbolo, tipo de orden y dirección, para
  encontrar rápido las órdenes de un setup.
- Como operador, quiero editar el precio de una orden colocada además de su SL y TP, para mover una
  entrada sin cancelarla y volver a colocarla.
- Como operador, quiero un Edit y un Cancel que apliquen a todas las órdenes de la lista, para mover o
  retirar un conjunto de órdenes de una vez.

## Criterios de aceptación

- CA 1. CUANDO se abre el Journal ENTONCES sus pestañas son Accounts, Positions, **Orders**, History;
  Positions muestra solo posiciones de mercado abiertas (desaparece la sección "Pending Orders") y Orders
  muestra todas las órdenes pendientes de todos los brokers, en vivo sobre el mismo mensaje `positions`
  del WebSocket que hoy.
- CA 2. CUANDO Orders está activa ENTONCES la tabla (escritorio) tiene Broker, Symbol (con la misma
  insignia de color que las posiciones: el color se guarda por broker y ticket mediante el
  `PATCH /positions/color` existente), Type, Lots, Price, Distance (pips desde el bid / ask actual al precio
  de la orden, con signo), SL, TP, Placed y las acciones por fila Edit / Cancel; por debajo de 768 px los
  mismos datos como tarjetas con acciones por deslizamiento, como las tarjetas de posiciones.
- CA 3. CUANDO se pulsa el botón Filters en Orders ENTONCES el panel ofrece Broker, Symbol, Type (Buy
  Limit / Sell Limit / Buy Stop / Sell Stop), Direction (Buy / Sell) y Color (los colores en uso, como en
  Positions); los valores persisten en
  `localStorage` separados de los filtros de Positions / History, y un enlace `?broker=…&symbol=…` aterriza
  en Orders cuando lleva `tab=orders`.
- CA 4. CUANDO se pulsa Edit en una orden ENTONCES un panel muestra su tipo, símbolo y broker y permite
  cambiar Price, SL y TP (un campo vacío conserva el valor actual); al enviar se manda un comando `modify`
  con `ticket`, `price`, `sl`, `tp` y el toast informa del resultado.
- CA 5. CUANDO todas las órdenes listadas (tras los filtros) comparten símbolo y tipo ENTONCES la barra de
  pestañas muestra los **Edit** y **Cancel** de grupo, exactamente como Positions muestra su Edit / Close
  de grupo para un grupo del mismo símbolo y tipo: Edit abre el mismo panel para todas (Price, SL, TP);
  Cancel pide confirmación indicando la cantidad y envía un `close` por orden. Una lista mixta no muestra
  botones de grupo.
- CA 6. CUANDO el EA recibe un `modify` con un `price` mayor que 0 para una orden pendiente ENTONCES llama
  a `OrderModify` con ese precio (SL / TP como vengan); sin `price`, o para una posición de mercado,
  mantiene el precio de apertura como hoy. Una modificación rechazada (precio inválido, demasiado cerca del
  mercado) vuelve como el error habitual de `command_result`.
- CA 7. CUANDO se edita o cancela una orden ENTONCES la pestaña Orders se actualiza con el siguiente mensaje
  `positions` del WebSocket sin recarga manual, y la pestaña Positions no se ve afectada.
- CA 8. CUANDO no hay órdenes, o ninguna cumple los filtros ENTONCES la pestaña lo indica, como hace
  Positions.
- CA 9. Orders se comporta exactamente como Positions en todo lo no dicho arriba: doble clic en una fila
  (o doble toque en una tarjeta) abre el gráfico de ese broker y símbolo en H1; una tarjeta se despliega al
  tocarla y muestra Edit / Cancel al deslizar; la insignia de color rota colores al pulsar y se quita en el
  último; el botón Filters muestra el punto de filtro activo; la lista se ordena por broker y luego hora de
  colocación; los botones de grupo Edit / Cancel van donde Positions muestra su Edit / Close de grupo; el
  botón `+ New Trade` sigue disponible en la pestaña.

## Fuera de alcance

- Cambiar los lotes de una orden colocada (MT4 no puede: cancelar y volver a colocar).
- Ejecuciones parciales, caducidad, OCO o cualquier tipo de orden más allá de los cuatro pendientes de MT4.
- Acciones de grupo sobre un subconjunto de la lista (selección por fila).
- Histórico de órdenes (ejecutadas o canceladas): History sigue mostrando solo trades cerrados.
