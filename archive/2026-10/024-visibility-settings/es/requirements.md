# 024 — Ocultar brokers y símbolos desde Settings

> Estado: **cerrada**

## Contexto

Doce brokers alimentan la app y cada uno opera decenas de símbolos. El operador trabaja con unos pocos
y quiere el resto fuera de la vista: brokers ocultos en todos los sitios donde la app lista cuentas,
posiciones, órdenes, histórico u ofrece un broker a elegir, y símbolos ocultos por broker en todos los
sitios donde aparece una lista de símbolos. Es una preferencia **visual**: el EA, los flujos del backend,
las posiciones, las alertas y las notificaciones siguen funcionando para brokers y símbolos ocultos;
solo el frontend deja de mostrarlos. La preferencia se guarda con el resto de ajustes de visualización
en el servidor, así que el PC y el móvil muestran lo mismo.

## Capas afectadas

- db · backend · frontend

## Historias de usuario

- Como operador, quiero ocultar brokers con los que no estoy trabajando, para que el Journal, el gráfico
  y los paneles solo listen las cuentas que uso.
- Como operador, quiero ocultar símbolos dentro de un broker, para que sus listas de pares sean cortas
  y solo muestren lo que opero ahí.
- Como operador, quiero que el conjunto oculto me siga entre el PC y el móvil, para configurarlo una vez.

## Criterios de aceptación

- CA 1. CUANDO se abre Settings ENTONCES tiene una cuarta pestaña, **Visibility**, que lista todos los
  brokers conocidos por la app (de `/balances`) con un toggle **Visible**, el nombre de la cuenta, un
  recuento de símbolos ocultos ("3 symbols hidden · 42 visible") y un botón **Symbols** que abre un
  panel lateral (derecha, a ancho completo en el móvil, como el resto de paneles) con buscador, **Show
  all / Hide all** y una casilla por símbolo del broker (de `/symbols?broker=`) en orden alfabético,
  los ocultos tachados; un broker oculto muestra "Hidden everywhere" con su botón Symbols deshabilitado.
  Los cambios se aplican a la tabla al momento y se guardan con el mismo botón **Save** que Mirror y Display.
- CA 2. CUANDO se guardan los ajustes ENTONCES `PUT /settings` almacena `visibility: { hiddenBrokers:
  string[], hiddenSymbols: { [broker]: string[] } }` en los ajustes globales de visualización y
  `GET /settings` lo devuelve; los brokers o símbolos desconocidos de las listas se conservan (un broker
  que vuelva más tarde sigue oculto).
- CA 3. CUANDO un broker está oculto ENTONCES no aparece en: Accounts, Positions, Orders e History del
  Journal (sus filas y sus opciones de filtro), el selector de broker y el panel de filtros del gráfico,
  la lista de brokers de New Trade, el selector de broker de Stats, la lista de brokers del panel de
  notificaciones; las pestañas Devices / Mirror **no** se ven afectadas (Mirror sigue listando todos los
  brokers para que sus lotes sigan editables).
- CA 4. CUANDO un símbolo está oculto para un broker ENTONCES no aparece para ese broker en: filas y
  opciones de filtro de Positions y Orders, filas de History, selector de símbolo y filtros del gráfico,
  lista de símbolos de New Trade (para ese broker), chips de símbolos del panel de notificaciones; sigue
  apareciendo en los brokers donde no está oculto.
- CA 5. CUANDO la selección actual del gráfico pasa a estar oculta (su broker o su símbolo) ENTONCES el
  gráfico la sigue mostrando hasta que el operador elige otra; los selectores listan la oculta marcada
  como oculta mientras esté seleccionada, para que nada desaparezca bajo los pies del operador.
- CA 6. CUANDO un broker o símbolo oculto tiene posiciones abiertas, órdenes pendientes, alertas o
  notificaciones ENTONCES siguen funcionando y disparando; los botones de **grupo** de Orders / Positions
  cuentan solo las filas visibles; los resultados de comandos y los toasts de notificación siguen saliendo.
- CA 7. CUANDO se usa la pestaña Visibility en el móvil ENTONCES las filas de broker apilan nombre,
  recuento y toggle con el botón Symbols debajo, y el panel de símbolos usa los tamaños de New Trade
  (filas de 44 px).
- CA 8. CUANDO no hay nada oculto ENTONCES todas las páginas se comportan exactamente como hoy.

## Fuera de alcance

- Ocultar brokers de los flujos del backend, del EA o del endpoint de Day P&L.
- Visibilidad por usuario (los ajustes de visualización son globales, como el resto de Settings).
- Ordenar o renombrar brokers y símbolos.
