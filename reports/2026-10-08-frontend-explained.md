# Frontend — Las doce mejoras, explicadas

> 08/10/2026 · Acompaña al informe técnico [2026-10-08-frontend.md](2026-10-08-frontend.md), que tiene las referencias al código y las estimaciones. Aquí cada mejora se explica desde cero, sin rutas de archivo ni código.

---

## FE-01 · Un filtro antes de publicar y errores que se ven

**La pieza.** El proceso que lleva un cambio del repositorio a la web que usas, y la forma en que la aplicación reacciona cuando algo falla.

**Cómo funciona hoy.** Cuando se sube un cambio del frontend, un robot se conecta al servidor, descarga el código y lo compila directamente en la carpeta que el servidor web está sirviendo. No hay ningún paso previo que revise el código: el analizador de estilo y errores (ESLint) existe, pero nadie lo ejecuta, y hoy acumula 29 errores. Por otro lado, la aplicación tiene muchos sitios donde una petición al servidor puede fallar y el código no mira la respuesta: cerrar una posición muestra "Close sent" aunque el servidor haya rechazado la orden; guardar los ajustes marca "Saved" aunque no se haya guardado; si la sesión ha caducado, las listas aparecen vacías en vez de llevarte a la pantalla de login; un error inesperado al dibujar la pantalla la deja en blanco.

**Qué está mal.** Dos cosas distintas con la misma raíz: nadie comprueba. Ningún paso automático impide publicar código con errores conocidos, y la propia aplicación trata el fallo igual que el éxito en varias acciones importantes, incluidas las que envían órdenes al broker.

**Qué pasaría si no se toca.** Cada publicación es una apuesta: el único control es que el código compile. Y un día una orden de cierre fallará por un motivo real (EA parado, símbolo mal escrito) y la pantalla dirá que todo ha ido bien.

**Qué se cambia.** Se añade al robot de publicación un paso de comprobación (análisis de estilo, comprobación de tipos y tests) del que depende el despliegue; se corrigen los 29 errores acumulados; en cada acción que habla con el servidor se comprueba la respuesta y, si falla, se avisa con un mensaje; se elimina el doble aviso que aparece hoy al fallar una orden nueva; se pone una red global que captura cualquier error inesperado y muestra un mensaje en vez de una pantalla en blanco; y se arreglan dos detalles visibles (unas etiquetas sin estilo en las tarjetas de órdenes pendientes y unos botones con clases que no existen).

**Cómo se hace sin romper nada.** Primero el filtro, en modo informativo, hasta dejar los errores a cero; después se vuelve bloqueante. Las comprobaciones de respuesta se añaden acción por acción, probando con el backend parado que aparece el aviso correcto.

**Cómo sabremos que está bien.** Un cambio con un error de estilo a propósito no llega a producción. Con el backend apagado, cerrar una posición o guardar ajustes muestra un error, no un éxito.

**Ojo.** Pasar de "silencio" a "aviso" hará visibles fallos que hoy ocurren sin que nadie se entere; conviene revisarlos los primeros días en vez de asumir que son nuevos.

---

## FE-02 · Que la última petición sea la que manda

**La pieza.** La carga de velas, dibujos, símbolos y posiciones cuando cambias de símbolo, de broker o de marco temporal en el gráfico.

**Cómo funciona hoy.** Cada cambio lanza una petición al servidor y, cuando llega la respuesta, se pinta. Si cambias de símbolo dos veces seguidas, se lanzan dos peticiones y se pinta lo que llegue, en el orden en que llegue. No hay forma de decirle a la primera "ya no te necesito".

**Qué está mal.** Con una red lenta o un servidor ocupado, la respuesta antigua puede llegar después que la nueva y pisarla: ves las velas de un símbolo con el nombre de otro. Con los dibujos es peor: si la respuesta antigua llega tarde y haces cualquier retoque, la aplicación guarda esos dibujos bajo el símbolo nuevo. Es el único caso de toda la revisión en que un fallo de tiempo corrompe datos guardados. Además, si una carga de velas antiguas (al hacer scroll hacia atrás) falla, el gráfico deja de pedir más hasta que recargas; y al cambiar de broker, la aplicación nunca vuelve a elegir símbolo, de modo que un broker que no tenga el símbolo actual deja el gráfico vacío.

**Qué pasaría si no se toca.** Seguirá siendo raro, pero cuando pase será difícil de reproducir, y los dibujos cruzados aparecerán como "se me han movido las líneas".

**Qué se cambia.** Cada carga lleva una señal de cancelación: cuando cambia la selección, la petición anterior se cancela y su respuesta, si llega, se descarta. La carga de velas antiguas se marca como terminada tanto si va bien como si falla. Al cambiar de broker, si el símbolo actual no existe en el nuevo, se elige uno válido.

**Cómo se hace sin romper nada.** Es un patrón uniforme que se aplica efecto por efecto; el comportamiento normal (una sola petición en vuelo) no cambia.

**Cómo sabremos que está bien.** Con la red artificialmente lenta, cambiar de símbolo tres veces en un segundo deja siempre las velas y los dibujos del último, y los dibujos del símbolo anterior siguen intactos en el servidor.

**Ojo.** Nada de esto cambia lo que se ve cuando todo va rápido; su valor es en los momentos malos.

---

## FE-03 · Una sola forma de hablar con el servidor

**La pieza.** La capa que envía peticiones al backend y la que envía órdenes al broker.

**Cómo funciona hoy.** Hay unas cincuenta llamadas al servidor repartidas por la aplicación y cada una está escrita a mano: incluir la cookie, poner las cabeceras, comprobar (o no) si ha ido bien, convertir la respuesta. El identificador que acompaña a cada orden se genera con una función copiada seis veces. Hay tres sitios distintos que cierran una posición y cada uno envía datos ligeramente diferentes.

**Qué está mal.** Lo que está copiado cincuenta veces se hace cincuenta veces de forma ligeramente distinta. Y hay algo que ninguna de las copias hace: reaccionar a "tu sesión ha caducado". Hoy ese caso se confunde con "no hay datos".

**Qué pasaría si no se toca.** Cada nueva pantalla repite el patrón, y cualquier mejora transversal (reintentos, avisos, cancelación) hay que hacerla cincuenta veces.

**Qué se cambia.** Una única función para llamar al servidor que incluye la cookie, lanza un error claro cuando la respuesta no es correcta y, ante una sesión caducada, cierra la sesión en la aplicación y te lleva al login (volviendo después a la página en la que estabas). Una única función para enviar órdenes, con un solo generador de identificadores, usada por las siete pantallas que hoy envían comandos. Las dos listas de alertas (precio y EMA), que hoy tienen cada una su copia de la misma lógica, comparten una.

**Cómo se hace sin romper nada.** Se crea la función nueva y se migran primero las acciones que hoy mienten (órdenes y ajustes), después el resto archivo por archivo. En cada paso, la petición que sale al servidor debe ser idéntica a la anterior.

**Cómo sabremos que está bien.** Borrar la cookie de sesión y pulsar cualquier cosa lleva al login en menos de un segundo. Las tres formas de cerrar una posición envían exactamente el mismo mensaje.

**Ojo.** Toca muchos archivos; conviene hacerlo en commits pequeños para poder revisar cada migración.

---

## FE-04 · Que un tick no repinte toda la pantalla

**La pieza.** La forma en que los precios en vivo (diez veces por segundo por broker) y las posiciones abiertas (una vez por segundo) llegan a lo que ves.

**Cómo funciona hoy.** Cada mensaje de precio se guarda en el estado de la página del gráfico, y guardar en ese estado hace que React vuelva a calcular la página entera: la barra de herramientas, los cinco paneles laterales (aunque estén cerrados, siguen montados) y el propio gráfico. Diez veces por segundo. Las posiciones hacen algo parecido cada segundo, y además cada vez que llegan el gráfico borra todas sus líneas de precio y las vuelve a crear, aunque no haya cambiado nada y aunque tengas las posiciones ocultas. En el journal, cada mensaje de cada broker reordena la lista completa parseando fechas dentro de la ordenación, y vuelve a calcular las tres pestañas. En el scanner, cada tick copia la tabla entera de precios.

**Qué está mal.** Casi todo ese trabajo produce exactamente la misma pantalla que había. Es CPU y batería gastadas en no cambiar nada, y en móvil se nota.

**Qué pasaría si no se toca.** Con más brokers, más posiciones o más paneles, la aplicación se irá volviendo pesada sin que ningún cambio concreto parezca culpable.

**Qué se cambia.** El precio en vivo deja de pasar por el estado de la página: va directo a la vela del gráfico, que ya sabe actualizarse sola, y solo llega a un panel cuando ese panel está abierto. Las posiciones solo se guardan si de verdad han cambiado, y las líneas existentes se actualizan en lugar de recrearse. El scanner acumula los precios y los vuelca una vez por frame. El journal calcula las fechas una sola vez al recibir y solo avisa a la página si cambia algo. Los paneles grandes se marcan para que React los salte cuando sus datos no cambian. Y el sondeo del beneficio diario se pausa cuando la pestaña del navegador no está visible.

**Cómo se hace sin romper nada.** Pieza a pieza, midiendo con el profiler de React cuántas veces por segundo se repinta cada página antes y después.

**Cómo sabremos que está bien.** Con el gráfico quieto y precios llegando, la página se repinta cero veces por segundo (hoy unas diez). El journal con doce brokers, igual.

**Ojo.** Es el cambio con más sutileza técnica del primer tramo: el orden en que React ejecuta efectos y referencias importa. Mejor después de tener el filtro de CI de FE-01.

---

## FE-05 · Pedir cada dato una vez y compartirlo

**La pieza.** Los datos de referencia (balances, ajustes, símbolos de cada broker), las posiciones en vivo y la conexión permanente con el servidor.

**Cómo funciona hoy.** Siete sitios distintos piden la lista de balances al servidor, cinco piden los ajustes. Abrir el journal pide los balances dos veces; abrir el gráfico pide los ajustes dos veces; abrir el panel de nueva orden vuelve a pedir ambos. Nadie guarda nada entre pantallas. La conexión permanente se abre al cargar la aplicación, antes incluso de iniciar sesión, nunca se cierra y, si se corta, reintenta cada tres segundos para siempre; al reconectar, nadie recupera las velas que se perdieron durante el corte. Cada pantalla interpreta los mensajes a su manera, con su propia copia de la descripción del formato, y el nombre del broker se añade a cada posición en cuatro sitios distintos.

**Qué está mal.** Trabajo repetido y, sobre todo, incoherencia: si guardas los ajustes, las pantallas que ya los habían pedido no se enteran. La conexión abierta sin sesión es una pequeña grieta de seguridad y la reconexión fija castiga al servidor cuando muchos clientes se reconectan a la vez.

**Qué pasaría si no se toca.** Más peticiones por pantalla a medida que crezca la aplicación, y datos que no coinciden entre pestañas hasta recargar.

**Qué se cambia.** Un proveedor común, en el marco de la aplicación, que guarda balances, ajustes y símbolos y los sirve a quien los pida; una petición en vuelo por recurso; y una forma de invalidarlos cuando se guarda algo. Un único hook de "posiciones en vivo" que usan el gráfico y el journal, que añade el broker una sola vez y evita que un dato viejo pise uno nuevo. Una descripción única y tipada de los mensajes del servidor. Y una conexión que se abre al iniciar sesión, se cierra al salir, reintenta con esperas crecientes y, al reconectar, avisa para que las pantallas se pongan al día.

**Cómo se hace sin romper nada.** Primero el proveedor y la migración de los que hoy piden balances y ajustes; después las posiciones; por último la conexión. En cada paso, la pestaña Network del navegador muestra si una petición ha desaparecido o se ha duplicado.

**Cómo sabremos que está bien.** Abrir cualquier página pide cada recurso una vez. Apagar el backend un minuto y encenderlo: la aplicación vuelve sola, con velas y posiciones al día, sin recargar.

**Ojo.** Cambiar cuándo se abre la conexión afecta al login y al logout; probar ambos en móvil y escritorio.

---

## FE-06 · Publicar sin apagar la web

**La pieza.** El script que compila y publica el frontend en el servidor, y lo que el navegador descarga al entrar.

**Cómo funciona hoy.** El robot compila el código nuevo directamente en la carpeta que el servidor web está sirviendo. La herramienta de compilación primero vacía esa carpeta y luego escribe los archivos nuevos: durante esos segundos, quien entre recibe errores, y si la compilación falla, la carpeta queda vacía y la web caída hasta que alguien lo arregle. El backend ya resolvió esto en su día compilando en una carpeta aparte y cambiando el nombre al final, con vuelta atrás si algo falla. La configuración del servidor web no está en el repositorio, así que no se sabe qué cabeceras de caché aplica. Además, el navegador descarga al entrar todo el código de todas las páginas, incluida la librería de gráficos, aunque solo vaya a ver el login.

**Qué está mal.** Cada publicación tiene una ventana de caída y un riesgo de caída larga. La primera carga es más pesada de lo necesario.

**Qué pasaría si no se toca.** Tarde o temprano una compilación fallará en el servidor en mal momento.

**Qué se cambia.** El script compila en una carpeta nueva y, solo si todo ha ido bien, la intercambia con la actual (guardando la anterior por si hay que volver). La configuración del servidor web se guarda en el repositorio con las cabeceras correctas: la página principal nunca se cachea, los archivos con huella se cachean para siempre. Cada página se carga solo cuando se visita. Las fuentes se conectan antes para que aparezcan a la primera. Y se retiran una dependencia y un icono que nadie usa.

**Cómo se hace sin romper nada.** El script nuevo se prueba primero con un despliegue manual mientras se vigila la web con peticiones en bucle.

**Cómo sabremos que está bien.** Durante una publicación, cero respuestas de error. Al entrar en el login, el navegador no descarga la librería de gráficos.

**Ojo.** La carga por página requiere que los archivos antiguos sigan disponibles un rato tras publicar (quien tenga la web abierta pedirá el siguiente trozo con el nombre viejo); por eso el intercambio conserva los assets anteriores.

---

## FE-07 · Un solo panel lateral

**La pieza.** Los ocho paneles que se abren sobre la página: nueva orden, filtros, edición en bloque, cerrar posición, confirmación, alertas, indicadores y filtros del gráfico.

**Cómo funciona hoy.** Cada uno tiene su propia copia del fondo oscurecido, de la cabecera con título y botón de cerrar, del deslizamiento desde el lateral y de la versión móvil que sube desde abajo. Unas cuatrocientas líneas de estilo repetidas. Ninguno se cierra con la tecla Escape ni se identifica como diálogo para lectores de pantalla.

**Qué está mal.** Cualquier mejora (Escape, accesibilidad, un detalle visual) hay que hacerla ocho veces, y ya hay diferencias involuntarias entre ellos.

**Qué pasaría si no se toca.** El noveno panel copiará uno de los ocho, probablemente no el mejor.

**Qué se cambia.** Un componente de panel compartido que aporta el fondo, la cabecera, el cierre con botón y con Escape, el comportamiento móvil y la identificación como diálogo; cada panel pasa a ser solo su contenido.

**Cómo se hace sin romper nada.** Se migra un panel, se compara en escritorio y móvil con una captura previa, se sigue con el siguiente.

**Cómo sabremos que está bien.** Los ocho paneles se ven igual que antes, todos se cierran con Escape y el estilo compartido ocupa una fracción de las líneas actuales.

**Ojo.** El panel de alertas es más ancho que los demás; el componente debe admitir ese ancho.

---

## FE-08 · Las reglas de diseño como valores reales

**La pieza.** Las variables de diseño (colores, tamaños, espaciados, capas) y unos detalles de comportamiento en móvil.

**Cómo funciona hoy.** Los colores y las fuentes están definidos como variables y se usan bien casi en todas partes; un tamaño de texto no coincide entre la guía y el código. Pero las escalas de espaciado, de profundidad de capas, de radios y de duración de animaciones solo existen escritas en la guía, no como variables, así que cada archivo pone su número: hay fondos de panel con una profundidad que no está en la escala, el menú móvil está muy por debajo de lo que dice la guía, y el color de "hover" de compra existe en tres intensidades distintas. El gráfico y la gráfica de balance, al dibujar en canvas, llevan la paleta copiada a mano. Tres campos numéricos todavía muestran las flechitas de incremento que la regla del proyecto dice que no deben verse, porque la regla que las quita vive en algunos archivos y no en el global. Y la etiqueta de la página que permite usar las zonas seguras del iPhone (alrededor del notch) no está puesta, así que los márgenes previstos para ellas posiblemente no actúan.

**Qué está mal.** La guía dice una cosa y el código, en los bordes, otra; y las flechitas y el notch son fallos visibles en móvil.

**Qué pasaría si no se toca.** Más valores sueltos con cada pantalla nueva y la guía cada vez menos fiable.

**Qué se cambia.** La regla de las flechitas pasa al global y se añade el tipo de teclado adecuado a cada campo numérico; se activa la etiqueta de zonas seguras (y se comprueba en un iPhone); se decide el tamaño de texto discrepante; se crean variables para las transparencias, las capas y la superposición; la paleta de los canvas sale de un único módulo; se añaden el estilo de barra de scroll para Firefox y unos retoques menores.

**Cómo se hace sin romper nada.** Las variables nuevas se definen con los valores que ya se usan; donde hay varias intensidades se elige una y el cambio visual es mínimo.

**Cómo sabremos que está bien.** Ningún campo numérico muestra flechitas; una búsqueda de valores sueltos de capas da cero; la guía y el código coinciden; en un iPhone con notch el contenido respeta los márgenes.

**Ojo.** Cambiar profundidades de capa puede alterar qué queda encima de qué; revisar paneles abiertos sobre el gráfico y el menú móvil.

---

## FE-09 · Un dominio común con una sola definición de pip

**La pieza.** Las funciones que todas las pantallas comparten para tipos de posición, beneficio, pips, moneda y fechas, y el formateo de filas y tarjetas.

**Cómo funciona hoy.** Esas funciones viven dentro de la carpeta del journal, pero las usan el gráfico, las estadísticas, los ajustes y hasta la capa de utilidades, que no debería depender de una pantalla. Hay tres formas distintas de calcular cuánto vale un pip: el journal usa una regla simple (yen o no yen), el gráfico otra a partir de los decimales, y el scanner la que manda el backend, que es la buena. Con el oro, el journal en modo pips da un número que no corresponde. El formateo de precios e importes está copiado en cada fila y en cada tarjeta, y ya hay diferencias: el swap positivo sale en verde en la tabla y sin color en la tarjeta. Queda además código que nadie usa (una página de dashboard, unas ciento cincuenta líneas de estilos, un par de constantes).

**Qué está mal.** Tres verdades para un mismo número y una estructura de carpetas que no refleja quién usa qué.

**Qué pasaría si no se toca.** Más divergencias entre tabla y tarjeta, y pips distintos según la pantalla.

**Qué se cambia.** Las funciones de dominio pasan a una carpeta compartida; se crea un único conjunto de formateadores y una única función de tamaño de pip y de precisión de precio (con una decisión tuya sobre el oro); un único parser de fechas del EA; se corrigen las divergencias detectadas; se borra lo muerto; y los paneles de trading que usan varias pantallas salen del journal.

**Cómo se hace sin romper nada.** Primero mover sin cambiar (solo rutas de importación), después unificar formateadores comparando capturas, y por último la decisión del pip, que es la única que cambia números en pantalla.

**Cómo sabremos que está bien.** Filas y tarjetas muestran lo mismo; los tests de FE-10 cubren las funciones movidas; una búsqueda de exportaciones sin uso da cero.

**Ojo.** Unificar el pip cambiará lo que ves en el oro (y en cualquier instrumento no forex) en modo pips; conviene acordarlo antes y anunciarlo.

---

## FE-10 · Tests y herramientas iguales que en el backend

**La pieza.** Las comprobaciones automáticas del frontend.

**Cómo funciona hoy.** No hay ningún test. Las funciones que calculan el beneficio, los pips, los rangos de fechas y la proyección de riesgo se comprueban solo mirando la pantalla. El backend, desde una spec anterior, tiene análisis, comprobación de tipos, tests, versión de Node fijada y formateo automático; el frontend no tiene ninguno de los cuatro últimos.

**Qué está mal.** Cualquier refactor de las piezas grandes (los siguientes puntos) se haría a ciegas.

**Qué pasaría si no se toca.** FE-11 y FE-12 serían demasiado arriesgados para abordarlos.

**Qué se cambia.** Se instala el mismo ejecutor de tests que usa el backend, se añaden los scripts que faltan y el formateo con la misma configuración, y se escriben los primeros tests sobre las funciones puras: beneficio en sus cuatro modos para compra y venta y para pares con yen, fechas, proyección de riesgo, rangos de fechas y ordenación.

**Cómo se hace sin romper nada.** Nada de esto toca código de producción; los tests describen lo que las funciones hacen hoy.

**Cómo sabremos que está bien.** Los tests pasan en local y en el filtro de CI.

**Ojo.** Escribir el test del beneficio obligará a decidir qué es "correcto" en los casos límite (sin cotización, balance cero); eso es una virtud.

---

## FE-11 · Partir el gráfico en piezas

**La pieza.** La página del gráfico y el componente que dibuja las velas, con sus indicadores, líneas de posición, dibujos y overlays.

**Cómo funciona hoy.** Dos archivos de quinientas y mil cien líneas que mezclan todo: selección y teclas rápidas, pantalla completa, carga de velas, dibujos, indicadores, posiciones, arrastre de stop y take profit, leyenda, capas de dibujo encima del canvas. El filtro que quita los fines de semana está escrito cuatro veces. Al mover o hacer zoom, por cada línea de cambio de día se recorre el histórico completo creando un objeto de fecha por vela: en una hora con dos mil velas, más de cien mil objetos por frame. Dos bucles de animación corren sin parar aunque no cambie nada. Los overlays no tienen en cuenta la densidad de píxeles, así que en pantallas retina se ven borrosos.

**Qué está mal.** Es la parte más valiosa de la aplicación y la más difícil de tocar con seguridad.

**Qué pasaría si no se toca.** Cada nueva función del gráfico se añade al mismo archivo, y cada corrección arriesga otra cosa.

**Qué se cambia.** La página se divide en hooks por responsabilidad (selección, pantalla completa, velas, dibujos, preferencias) y el componente de gráfico en módulos (matemáticas puras y testeables, tema, series de indicadores, overlay, niveles de posición, arrastre, leyenda y botones). Los cálculos por frame se cachean y se busca por bisección en vez de recorrer; los bucles de animación solo corren cuando algo ha cambiado; los overlays respetan la densidad de píxeles.

**Cómo se hace sin romper nada.** Primero se extraen las funciones puras y se cubren con tests; después cada módulo, comparando visualmente y con el profiler. Solo tras FE-10.

**Cómo sabremos que está bien.** Mismo aspecto, menos CPU al mover el gráfico, líneas nítidas en retina, y ningún archivo del gráfico supera unas trescientas líneas.

**Ojo.** Es el refactor de más riesgo de la lista por la cantidad de referencias y temporización entre efectos; se hace en varias specs, no en una.

---

## FE-12 · Botones, campos y listas hechos una sola vez

**La pieza.** Los elementos básicos de interfaz (botones, campos, selectores) y las listas de datos que se muestran como tabla en escritorio y como tarjetas en móvil; también la herramienta de dibujo del gráfico.

**Cómo funciona hoy.** No hay un componente de botón ni de campo: hay unas cuarenta y cinco clases de botón repartidas por dieciséis archivos que se reducen a cinco variantes reales, y trece definiciones del mismo campo de texto. La lista de marcos temporales está escrita cuatro veces y el selector de broker ocho. Las listas de datos están implementadas dos veces cada una (una tabla y un juego de tarjetas) con el formateo copiado, y el scanner no tiene versión móvil. La herramienta de dibujo es un único archivo de mil doscientas líneas que mezcla tipos, guardado, detección de clics, gestos y pintado.

**Qué está mal.** Lo que debería escribirse una vez está escrito decenas de veces y, como se vio en FE-09, empieza a divergir.

**Qué pasaría si no se toca.** Cada pantalla nueva es más cara que la anterior y menos coherente.

**Qué se cambia.** Un botón con sus tres tamaños y variantes, un campo y un selector, selectores de broker y de marco temporal, campos de rango de fechas y una única lista de marcos temporales. Una lista de datos que, a partir de una definición de columnas, pinta la tabla y las tarjetas con el mismo formateo, con el gesto de doble toque compartido, y que da al scanner su versión móvil. La herramienta de dibujo se divide en módulos, con tests previos de guardado y detección.

**Cómo se hace sin romper nada.** Por etapas y por pantalla, siempre con captura previa; las listas se migran una a una.

**Cómo sabremos que está bien.** Cada pantalla se ve igual, el scanner tiene tarjetas en móvil y las clases de botón y campo quedan en una decena.

**Ojo.** Es el bloque más largo y el menos urgente; su valor es acumulativo y depende de que FE-07 a FE-10 estén hechos.

---

## Cómo encajan las doce

Las tres primeras (FE-01, FE-02, FE-03) son las que cambian lo que puede salir mal hoy: nada se publica sin pasar un filtro, ningún fallo se disfraza de éxito, ninguna respuesta tardía mezcla datos y la sesión caducada lleva al login. Las tres siguientes (FE-04, FE-05, FE-06) hacen que la aplicación trabaje lo justo: repintar solo lo que cambia, pedir cada dato una vez, publicar sin apagar la web y cargar solo la página que se visita. Las cuatro del tercer bloque (FE-07 a FE-10) ponen cimientos: un panel común, las reglas de diseño como variables, un dominio compartido con un solo pip y los primeros tests. Las dos últimas (FE-11 y FE-12) son los refactors grandes que esos cimientos hacen posibles: partir el gráfico y escribir una sola vez los botones, los campos y las listas. Cada bloque se puede detener sin dejar nada a medias, y cada mejora se abre como spec con su validación en producción.
