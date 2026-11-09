# 039 — Overlay de trades por cruce de EMAs

> Status: **closed**

## Contexto
El trader opera setups de cruce de EMAs: la vela en la que la EMA rápida cruza la lenta activa una entrada; la entrada se sitúa unos pips más allá del cierre de esa vela y el stop en el extremo anterior de la EMA rápida (el EVL que ya lista el panel New Trade). Hoy esos niveles existen solo para el último setup (`GET /setup-levels`, spec 035) y se leen como números; nada los muestra en el chart ni enseña cómo habrían quedado los setups anteriores. El trader quiere un botón en la toolbar que dibuje los últimos N trades de ese tipo en el chart, con la entrada y el SL proyectados durante la vida de cada setup, con parámetros elegidos una vez en Ajustes.

## Capas afectadas
- frontend · backend · db

## Historias de usuario
- Como trader, quiero un botón en la toolbar que dibuje los últimos trades por cruce de EMAs en el chart que estoy mirando, para ver de un vistazo dónde cayeron las entradas y los stops de esta estrategia.
- Como trader, quiero que cada trade muestre su nivel de entrada y su nivel de SL mientras el setup estuvo vivo, para juzgar cómo se comportó el precio frente a ellos.
- Como trader, quiero que los periodos de las EMAs, el offset de entrada, la duración máxima y el número de trades vivan en Ajustes, para que todos los charts usen las mismas reglas sin volver a introducirlas.

## Criterios de aceptación
- AC 1. CUANDO el usuario pulsa el botón "EMA cross trades" de la toolbar ENTONCES el chart dibuja los últimos N trades por cruce de EMAs (N desde Ajustes, 3 por defecto) del broker, símbolo y timeframe del chart, en ambas direcciones, incluido el más reciente; pulsar de nuevo los oculta. El botón queda resaltado mientras el overlay está activo. Cada chart del split view tiene su propio botón y su propio overlay.
- AC 2. CUANDO se dibuja un trade ENTONCES tiene: una línea vertical discontinua tenue en la vela del cruce (la vela en la que la EMA rápida cruza la lenta); una línea de **entrada** sólida dorada en el cierre de la vela del cruce más los pips configurados para una compra (menos para una venta); una línea de **SL** discontinua roja en el EVL anterior de la EMA rápida (el extremo de la EMA rápida desde el cruce contrario anterior, tal como lo calcula `detectEmaCrossSetups`); un relleno tenue entre entrada y SL; una etiqueta `#n BUY|SELL · <fecha hora del cruce>` en lo alto de la línea vertical; y etiquetas en el extremo derecho de las líneas: `BUY|SELL <precio de entrada>` en la entrada y `SL <riesgo en pips> p` en el SL.
- AC 3. CUANDO se dibuja un trade ENTONCES sus líneas de entrada y SL empiezan en la vela del cruce y terminan en el siguiente cruce contrario o al cumplirse las horas máximas configuradas, lo que llegue antes; un trade aún vivo termina a las horas configuradas aunque sea más allá de la última vela.
- AC 4. CUANDO el EVL no existe para un cruce (sin cruce contrario anterior en el historial cargado) ENTONCES ese trade se dibuja sin línea de SL, relleno ni etiqueta de SL.
- AC 5. CUANDO el overlay está activo y el usuario cambia de símbolo, timeframe o broker, o cierra una vela nueva ENTONCES el overlay se recalcula con los datos nuevos; CUANDO el chart se desplaza o hace zoom ENTONCES el overlay sigue a las velas como los dibujos.
- AC 6. El overlay no es un dibujo: nunca se envía a `/drawings`, no es seleccionable, Supr / Borrar todo y el bloqueo lo ignoran, y no cuenta para los botones de borrar / borrar todo. Su estado on/off se recuerda por navegador (chart izquierdo y derecho por separado) como el bloqueo del chart.
- AC 7. CUANDO el trader abre Ajustes > Display ENTONCES un grupo "EMA cross trades" ofrece: EMA rápida (24 por defecto), EMA lenta (48 por defecto), offset de entrada en pips (5 por defecto, 0 permitido), duración máxima en horas (24 por defecto), trades mostrados (3 por defecto, 1–10). CUANDO el trader guarda ENTONCES todos los charts con el overlay activo se redibujan con los valores nuevos.
- AC 8. CUANDO el chart tiene menos velas de las que necesita la EMA lenta, o no existe ningún cruce ENTONCES el overlay no dibuja nada y el botón sigue resaltado (sin error).

## Fuera de alcance
- Niveles de take profit, múltiplos de R o estadísticas de resultado de los trades dibujados (las páginas Book y Stats cubren los resultados).
- Parámetros por chart o por símbolo: el grupo de Ajustes es global, como el resto de Display.
- Alertas o notificaciones desde este overlay (ya existen las notificaciones de EMA de la spec 023).
- Cambios de maquetación específicos de móvil más allá de que el botón aparezca en la fila Draw.
