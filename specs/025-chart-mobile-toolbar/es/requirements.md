# 025 — Arreglos del gráfico: barra móvil, dibujos y panel de alertas

> Estado: **aprobada**

## Contexto

En el teléfono la barra del gráfico mete trece controles en una fila: el select de timeframe más doce
botones de icono (posiciones, alertas, línea de tendencia, rectángulo, regla, marcadores de compra /
venta, cruz, check, texto, filtros, indicadores, pantalla completa). Cada icono se queda en unos 30 px
y pegado al vecino, muy por debajo de los 44 px que usa el resto de la interfaz móvil, así que acertar
la herramienta es una lotería. En escritorio está bien y se queda como está. Se suma un segundo defecto
sin relación: las líneas de rollover pintadas en el canvas superpuesto no se recortan al panel de velas,
así que al desplazar el gráfico a la derecha se pintan encima de la escala de precios. El punto más
serio es el hueco de la vela cerrada: las velas cerradas solo llegan a la base de datos por los ficheros
`candles_<SYM>_<TF>.json` que el EA escribe en su propio ciclo y el watcher lee cada 30 s, así que
durante hasta un minuto tras un cierre ni el gráfico ni una recarga tienen la última vela cerrada,
cuando el backend ya tiene su OHLC por los ticks.

## Capas afectadas

- db · backend · frontend

## Historias de usuario

- Como operador en el teléfono, quiero las herramientas del gráfico que uso a diario a tamaño de dedo,
  para abrir posiciones, alertas, filtros y pantalla completa sin toques fallidos.
- Como operador en el teléfono, quiero las herramientas de dibujo apartadas hasta que las necesite, para
  que el gráfico conserve su altura mientras solo miro el precio.
- Como operador, quiero la vela que acaba de cerrar en el gráfico en el momento en que cierra, para
  actuar sobre el cierre sin un minuto a ciegas.

## Criterios de aceptación

- CA 1. CUANDO el gráfico se abre en un teléfono (max-width 768 px) ENTONCES la barra muestra una fila
  con el select de timeframe, los botones de posiciones, alertas, filtros, indicadores y pantalla completa y un botón
  **Draw**; todos los botones miden 44 px de alto y al menos 44 px de ancho, con 4 px entre ellos.
- CA 2. CUANDO el operador toca Draw ENTONCES se abre una segunda fila bajo la primera con las ocho
  herramientas de dibujo (línea, rectángulo, regla, marcador de compra, marcador de venta, cruz, check,
  texto) a los mismos tamaños; el botón Draw aparece activo mientras la fila está abierta; tocarlo de
  nuevo la cierra.
- CA 3. CUANDO se selecciona una herramienta de dibujo ENTONCES aparece activa en la segunda fila, el
  botón Draw sigue activo y la fila sigue abierta hasta que el operador la cierre o termine el dibujo;
  al terminar la herramienta (el `onDrawDone` actual) la fila sigue abierta para que el siguiente dibujo
  esté a un toque.
- CA 4. CUANDO la segunda fila está abierta ENTONCES el área del gráfico se reduce la altura de la fila,
  nada se superpone al gráfico; al cerrarla el gráfico recupera la altura.
- CA 5. CUANDO el gráfico está en pantalla completa en el teléfono ENTONCES aplica la misma barra de dos
  filas.
- CA 6. CUANDO la ventana es más ancha de 768 px ENTONCES la barra es exactamente la de hoy (una fila,
  todas las herramientas visibles, sin botón Draw).
- CA 7. CUANDO el operador gira el teléfono o cruza el breakpoint ENTONCES la barra cambia de disposición
  sin perder la herramienta seleccionada.
- CA 8. CUANDO el gráfico se desplaza de modo que una línea de rollover (diaria, semanal o de inicio de
  mes) cae más allá de la última vela ENTONCES la línea se detiene en el borde derecho del panel de velas
  y nunca se pinta sobre la escala de precios; en cualquier dispositivo.
- CA 9. CUANDO un rectángulo está seleccionado ENTONCES muestra ocho anclas, una por esquina y una en el
  centro de cada borde, más una cruz en su centro: arrastrar una esquina redimensiona libremente (como
  hoy), arrastrar un ancla de borde redimensiona solo ese borde (horizontal en las de izquierda /
  derecha, vertical en las de arriba / abajo) y arrastrar la cruz mueve el rectángulo entero conservando
  su tamaño; el cursor refleja cada acción en escritorio y las anclas tienen un objetivo táctil de 44 px
  en el teléfono.
- CA 10. CUANDO se selecciona un marcador de compra, de venta, un check o una cruz ENTONCES muestra un anillo
  naranja (`--orange`) de 1 px a su alrededor, con 4 px de holgura, para que la selección se vea antes de
  arrastrarlo o borrarlo; los marcadores sin seleccionar se ven exactamente como hoy.
- CA 11. CUANDO se selecciona una etiqueta de texto ENTONCES solo su texto pasa a naranja (`--orange`), sin
  marco punteado alrededor; las etiquetas sin seleccionar conservan su color como hoy.
- CA 12. CUANDO el panel de alertas muestra sus botones "Add alert" y "Add EMA alert" ENTONCES usan el estilo
  de envío primario de los paneles (48 px, fondo `--orange`, texto negro en mayúsculas, sin radio) como New
  Trade y los paneles de edición; los estados deshabilitado / guardando mantienen el estilo con opacidad
  reducida.
- CA 13. CUANDO la vela viva se mueve ENTONCES cada línea de EMA se extiende hasta ella con un valor
  provisional calculado desde la última EMA cerrada y el cierre vivo, actualizado en cada tick como la
  propia vela; al cerrar la vela el punto provisional se sustituye por el cerrado sin salto, y las EMAs
  nunca van una vela por detrás del precio.
- CA 14. CUANDO el `<tf>_time` de un tick avanza para un símbolo (la vela de ese timeframe cerró) ENTONCES
  el backend escribe al momento esa vela cerrada en `candles`, construida desde el último tick de la vela
  anterior (apertura / máximo / mínimo de los campos `<tf>_*` del tick, cierre = su bid), y la emite por
  WebSocket como `candle` con el broker en la raíz; el gráfico añade o sustituye esa vela de inmediato, y
  una recarga dentro del hueco ya la muestra. El fichero del EA conserva la autoridad: cuando el watcher
  lo lea después, sus valores sobrescriben la fila construida desde ticks.
- CA 15. CUANDO se crea, activa / desactiva, borra o dispara una alerta de precio ENTONCES su marcador en
  la escala de precio aparece, cambia o desaparece al momento, sin desplazar, hacer zoom ni cambiar de
  símbolo.
- CA 16. CUANDO hay un rectángulo en el gráfico ENTONCES su esquina superior derecha muestra el precio de
  su borde superior, la inferior derecha el precio de su borde inferior y la inferior izquierda la
  altura en pips (`24.5 p`), a 9 px en blanco (`--text`) con contorno negro, fuera de la forma y sin tocar las anclas,
  actualizado en vivo al dibujarlo o redimensionarlo.
- CA 17. CUANDO el operador desactiva **Rectangle labels** en Settings > Display y guarda ENTONCES el
  gráfico dibuja los rectángulos sin los precios y pips del CA 16; el ajuste se guarda con los ajustes de
  visualización (activo por defecto) y aplica en todos los dispositivos.

## Fuera de alcance

- Cambios en las herramientas de dibujo distintos de las anclas del rectángulo y el aspecto de selección de
  marcadores y textos, la leyenda, la escala de
  precio o el manejo táctil del gráfico.
- La barra de escritorio.
- Los layouts móviles del Journal y de Settings.
