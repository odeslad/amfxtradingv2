# 033 — Presets de mirror

> Estado: **cerrada**

## Contexto
Hoy existe una única configuración de mirror (Settings › Mirror, tabla `settings_mirror`): por cada broker, si participa, el modo de lotes (lotes fijos o % de riesgo) y el valor. New Trade en modo mirror envía una orden por cada broker activo con esa configuración. Para operar con otro riesgo el operador tiene que editar Settings cada vez. Esta spec sustituye la configuración única por presets con nombre ("operaciones 0.5%", "operaciones 1%"…) que el operador elige en el formulario de New Trade.

## Capas afectadas
- db · backend · frontend

## Historias de usuario
- Como operador, quiero guardar varias configuraciones de mirror con nombre, para operar con distintos niveles de riesgo sin editar Settings.
- Como operador, quiero elegir el preset en el formulario de New Trade, para que la orden salga con esa configuración.
- Como operador, quiero que mi configuración de mirror actual se conserve como primer preset, para que nada cambie hasta que cree otros.
- Como operador, quiero que New Trade liste solo los símbolos que tengo visibles, para que los ocultos no estorben en el formulario.

## Criterios de aceptación
- CA 1. CUANDO abro Settings › Mirror ENTONCES veo la lista de presets, cada uno con su nombre y su configuración por broker (activo, modo de lotes, valor).
- CA 2. CUANDO creo, renombro, edito o borro un preset y guardo ENTONCES el cambio se guarda y se ve en escritorio y en móvil.
- CA 3. CUANDO se despliega la spec ENTONCES la configuración de mirror actual existe como un preset (llamado "Default", renombrable) y no se pierde ninguna configuración.
- CA 4. CUANDO abro New Trade en modo mirror ENTONCES puedo elegir un preset, y el panel lista los brokers y lotes de ese preset.
- CA 5. CUANDO envío una orden mirror ENTONCES sale una orden a cada broker activo en el preset elegido, con el modo de lotes y el valor de ese preset; Settings no cambia.
- CA 6. CUANDO vuelvo a abrir New Trade ENTONCES viene preseleccionado el último preset que usé (en ese dispositivo).
- CA 7. CUANDO solo existe un preset ENTONCES New Trade funciona como hoy con ese preset seleccionado.
- CA 8. CUANDO un preset no tiene ningún broker activo ENTONCES el modo mirror no puede enviarlo y el formulario lo indica, como el "No brokers enabled for mirror" de hoy.
- CA 9. El último preset que queda no se puede borrar.
- CA 10. CUANDO abro New Trade ENTONCES la lista de símbolos muestra solo los símbolos visibles (Settings › Visibilidad, spec 024): en modo manual, los visibles del broker elegido; en modo mirror, los comunes a los brokers activos del preset y visibles en todos ellos.
- CA 11. CUANDO se abre New Trade o cambia su lista de símbolos ENTONCES viene preseleccionado el símbolo del gráfico si se abrió desde el gráfico y está en la lista; si no, EURUSD si está en la lista; si no, ninguno; en los dos modos.

## Fuera de alcance
- Presets para el modo manual.
- Elegir preset desde otros sitios que no sean New Trade (gráfico, alertas).
- Cambios en los comandos enviados al EA o en el EA.
