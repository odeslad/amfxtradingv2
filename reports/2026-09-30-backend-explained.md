# Backend — Las once mejoras, explicadas

> 30/09/2026 · Acompaña a [Backend — Estado, diagnóstico y plan de mejora](2026-09-30-backend.md), misma numeración que su tabla de mejoras. Sin rutas de archivo ni código: cada pieza explicada desde cero. 1 SP = 1 hora de desarrollador senior.

---

## 1. Que una petición mal hecha no apague el servidor (4 SP)

**La pieza.** El backend es un único programa que hace muchas cosas a la vez: recibe los precios de los brokers, mantiene la lista de posiciones abiertas, vigila las alertas, atiende las peticiones de la web y envía órdenes al EA. Todo dentro del mismo proceso. Una parte de ese programa es el "servidor web": responde a peticiones como "dame los últimos 200 trades" o "dame las velas de EURUSD".

**Cómo funciona hoy.** Cuando llega una petición, el código lee los parámetros (cuántos trades, desde qué fecha, qué símbolo) y pregunta a la base de datos. Ese trabajo es asíncrono: el programa lanza la pregunta y sigue atendiendo otras cosas mientras espera la respuesta. Si la base de datos responde con un error — porque el parámetro era basura, porque la conexión parpadeó, por lo que sea — ese error tiene que ser recogido por alguien. En este backend no lo recoge nadie: no hay una pieza final que diga "si algo falla, responde con un error 500 y sigue".

**Qué está mal.** Las versiones modernas de Node tienen una regla: si una operación asíncrona falla y nadie recoge el error, el proceso entero se cierra. No la petición: el proceso. Y como en este proceso vive todo — los diez brokers, las alertas, la cola de órdenes — todo se reinicia. pm2 lo levanta de nuevo en unos segundos, pero durante esos segundos no hay precios, se pierden las alertas armadas en memoria hasta recargarlas, y si había una orden esperando confirmación del EA, nadie la escuchará. Basta con pedir `limit=abc` o `from=ayer` para provocarlo. El usuario ha confirmado que ve reinicios esporádicos.

**Qué se cambia.** Tres cosas. Primero, un "recogedor" final: cualquier error que se escape de una petición acaba en él, se escribe en el log y se responde con un 500 limpio. Segundo, un aviso de última instancia para que, si aun así algo se escapa, quede registrado en vez de matar el proceso. Tercero, validar los parámetros a la entrada: si `limit` no es un número o `from` no es una fecha, se responde 400 ("petición incorrecta") sin llegar siquiera a la base de datos.

**Cómo se hace sin romper nada.** El recogedor y el aviso se añaden primero: no cambian ninguna respuesta correcta, solo evitan la muerte. Después se envuelve cada ruta, una a una, y se sustituye cada lectura de parámetro por la versión validada. Cada paso es un commit pequeño.

**Cómo sabremos que está bien.** Se envía a propósito una tanda de peticiones con parámetros absurdos y el proceso sigue vivo respondiendo 400. Y el contador de reinicios de pm2 se queda a cero durante una semana.

**Ojo.** Es la primera mejora porque las demás se prueban en producción, y para eso necesitamos que el proceso no muera mientras probamos.

## 2. Que cerrar sesión cierre la sesión (2 SP)

**La pieza.** Al entrar con email y contraseña, el servidor entrega al navegador un "pase" (un token firmado) guardado en una cookie. En cada petición posterior el navegador enseña esa cookie y el servidor la acepta durante 7 días.

**Cómo funciona hoy.** La cookie se emite con un dominio explícito (`.amfxtrading.com`) para que valga en la web y en la API a la vez. Al pulsar "Sign out", el servidor ordena al navegador borrar la cookie llamada `token`… pero sin decir el dominio. Para el navegador, una cookie se identifica por nombre *y* dominio, así que la orden borra una cookie que no existe y la real sigue ahí.

**Qué está mal.** Cerrar sesión no cierra nada: la pantalla vuelve al login, pero al recargar la página el servidor ve la cookie, la acepta y entras de nuevo. Está confirmado en producción. Además, el formulario de login admite intentos ilimitados, y responde un poco más rápido cuando el email no existe (porque se salta la comprobación de contraseña), lo que permite adivinar qué emails tienen cuenta.

**Qué se cambia.** El borrado de la cookie se hace con exactamente los mismos atributos con los que se creó. En el login, cuando el email no existe se hace igualmente una comprobación de contraseña ficticia para que tarde lo mismo, y se limita a unos diez intentos por cuarto de hora.

**Cómo sabremos que está bien.** Sign out, recargar, y la app pide login. Once intentos seguidos de login fallido devuelven "demasiados intentos".

**Ojo.** El límite de intentos vive en memoria del proceso: se reinicia con él. Es suficiente para un usuario; si hubiera muchos habría que guardarlo en la base de datos.

## 3. Que un despliegue fallido no deje el servicio caído (4 SP)

**La pieza.** Cada vez que se sube código del backend a `master`, un robot de GitHub se conecta al servidor y ejecuta un guion: baja el código nuevo, instala dependencias, actualiza la base de datos, compila y arranca.

**Cómo funciona hoy.** El guion **para el servicio antes de compilar**. Lo hace por un motivo real: en Windows, un archivo de Prisma se queda bloqueado mientras el proceso corre y la instalación fallaba. Pero la consecuencia es que, si la compilación falla, el servicio ya está parado, la base de datos ya se ha migrado, la carpeta compilada está a medias, y el guion no lo comprueba ni tiene marcha atrás. Además nada verifica el código antes de llegar al servidor: no hay una etapa previa en GitHub que compile.

**Qué está mal.** El fallo es poco probable (se compila en local antes de subir), pero cuando ocurra el resultado es una caída hasta que alguien entre a mano. Y el vigilante automático del servidor, al ver el servicio caído, intentaría arrancar la versión a medias.

**Qué se cambia.** Se reordena el guion: bajar código, instalar, *comprobar que compila* — y solo si compila, parar el servicio, migrar, compilar de verdad en una carpeta limpia y arrancar. Al final, el guion pregunta al servicio "¿estás bien?" y falla si no responde en 30 segundos. En GitHub se añade una etapa que compila antes de tocar el servidor. Y la configuración de arranque (memoria, flags), hoy duplicada en dos guiones, pasa a un único archivo.

**Cómo se hace sin romper nada.** Se prueba con el botón de despliegue manual, primero con un error de tipos a propósito (debe fallar en GitHub sin tocar el servidor), luego con código bueno.

**Cómo sabremos que está bien.** Un despliegue con código roto termina en rojo con el servicio anterior aún funcionando.

**Ojo.** Hay que confirmar si la instalación de dependencias sigue necesitando el servicio parado; si el archivo bloqueado solo cambia cuando cambian las dependencias, la parada puede retrasarse aún más.

## 4. Que el sync de 30 segundos no duplique balances ni haga trabajo de más (5 SP)

**La pieza.** Cada 30 segundos, por cada broker, el backend lee tres archivos que el EA deja en disco: el estado de la cuenta, el historial de operaciones cerradas y las velas de cada símbolo y marco temporal. Con eso guarda en la base de datos los trades nuevos, las velas nuevas y un registro diario del balance.

**Cómo funciona hoy.** El registro diario del balance se hace así: "¿hay ya una fila de hoy para este broker? Si sí, actualízala; si no, créala". Es una pregunta y luego una acción. Si dos ejecuciones hacen la pregunta a la vez (por ejemplo porque la anterior se retrasó con la base de datos lenta), las dos reciben "no hay" y las dos crean. De ahí las filas duplicadas que ya se conocían. El lector de archivos tiene una protección para no solaparse, pero solo cubre las velas: el guardado de trades y balances se lanza y no se espera.

Por otro lado, el historial de trades se guarda uno a uno, con una consulta por trade, aunque todos existan ya (unas 50 consultas por broker cada 30 s; miles en un arranque). Y las velas se reinsertan enteras — unos 7 500 intentos de inserción por broker cada 30 s — para que quede quizá una fila nueva, la mitad de las veces sobre un archivo que el EA ni siquiera ha reescrito.

**Qué está mal.** Duplicados en balances (confirmados), consultas innecesarias que compiten con las peticiones de la web, y lecturas que bloquean el proceso entero — mientras se lee un archivo grande de velas, ningún broker recibe precios.

**Qué se cambia.** Se añade a la tabla de balances una columna "día" y una regla de la base de datos que prohíbe dos filas del mismo broker y día; el guardado pasa a ser "inserta o actualiza" en una sola operación, que la base de datos garantiza sin carrera. El lector espera a que cada guardado termine antes del siguiente ciclo. Los trades se insertan en una sola consulta que ignora los ya existentes. Y antes de leer un archivo de velas se comprueba si ha cambiado desde la última vez.

**Cómo se hace sin romper nada.** Primero se hace copia de la tabla de balances, se rellena la columna "día" desde la fecha existente, se borran los duplicados conservando el más reciente, y después se activa la regla. Luego se cambia el código.

**Cómo sabremos que está bien.** Una consulta que busque broker+día repetidos devuelve cero filas, hoy y dentro de un mes. El número de consultas por ciclo cae de miles a decenas.

**Ojo.** Hay que decidir qué es "día": hoy es la medianoche del servidor; podría ser UTC o el día del broker. Es una línea, pero es una decisión.

## 5. Que el WebSocket compruebe quién entra y no se atasque (4 SP)

**La pieza.** Además de peticiones sueltas, la web mantiene una conexión permanente con el backend por la que recibe precios, posiciones, cuenta y avisos en tiempo real. Es el WebSocket.

**Cómo funciona hoy.** Cuando un navegador pide abrir esa conexión, el backend la acepta primero y comprueba el pase después; si no es válido, la cierra. No mira desde qué web viene la petición. Y la cookie está configurada de forma que el navegador la envía aunque la petición la haga otra web. Una vez abierta, la conexión no se vigila: no hay "¿sigues ahí?" periódico, y si un cliente deja de leer (un móvil en segundo plano, una pestaña congelada), lo que se le manda se acumula sin límite en memoria. Todos los clientes reciben todo, incluidas las alertas de otros usuarios con su identificador.

**Qué está mal.** Cualquier página web que el usuario tenga abierta en el mismo navegador podría abrir esa conexión con su cookie y leer sus precios, posiciones y cuenta. Con un solo usuario y sin visitar webs hostiles, el riesgo práctico es bajo, pero es un agujero de los que se cierran en una hora. Y la acumulación sin límite es un consumo de memoria que crece hasta que pm2 reinicia por exceso.

**Qué se cambia.** Se comprueban origen y pase *antes* de aceptar la conexión. Se anota a qué usuario pertenece cada conexión para enviar las alertas solo a su dueño. Se envía un latido cada 30 segundos y se cierra a quien no responde. Y si un cliente acumula demasiado sin leer, se le deja de enviar y, si sigue, se le desconecta.

**Cómo sabremos que está bien.** Un intento de conexión desde otra web recibe "prohibido". Una pestaña congelada desaparece de la lista de clientes al minuto. La web sigue recibiendo precios igual que hoy.

**Ojo.** El frontend en producción vive en un subdominio de amfxtrading.com; si algún día se sirve desde otro dominio, hay que añadirlo a la lista permitida.

## 6. Que un "sin respuesta del EA" sea verdad (4 SP)

**La pieza.** Para operar, la web envía la orden al backend, el backend la escribe en un archivo, el EA lo lee (mira una vez por segundo), ejecuta la orden en MT4 y escribe el resultado en otro archivo, que el backend recoge y reenvía a la web.

**Cómo funciona hoy.** El backend espera el resultado hasta 10 segundos. Si no llega, avisa "sin respuesta del EA" y deja de escuchar. Pero el EA puede tardar más: un cierre reintenta hasta cinco veces, y MT4 puede ser lento. La orden se ejecuta a los 12 segundos, el resultado se escribe, y nadie lo lee; la siguiente orden lo ve con un identificador distinto y lo ignora. Además, el backend solo comprueba que la orden tenga acción, broker y símbolo: una acción mal escrita la consume el EA sin decir nada (otro timeout), un tamaño de lote ausente llega como cero, y del mensaje de error del EA solo llega "EA error".

**Qué está mal.** El usuario ve "sin respuesta", asume que no se ejecutó y repite. Es el único punto del sistema donde un fallo cuesta dinero real.

**Qué se cambia.** Validar la orden a la entrada (acción de la lista, lote positivo, ticket numérico cuando toca) y responder 400 al instante. Escribir el archivo de la orden de forma atómica (primero a un nombre temporal, luego renombrar) para que el EA nunca lea medio archivo. Leer el archivo "pendiente" que el EA ya escribe para alargar la espera mientras el EA sigue trabajando. Y si aun así expira, seguir escuchando un minuto más en segundo plano y, si el resultado aparece tarde, notificarlo como "resultado tardío" en vez de perderlo. Pasar el mensaje de error del EA tal cual.

**Cómo sabremos que está bien.** Una acción inválida devuelve error inmediato. Con el EA parado 12 segundos a propósito, la web recibe primero "pendiente" y luego el resultado real, no un timeout.

**Ojo.** Probar en cuenta demo. Y en la web hay hoy dos avisos por resultado (uno general y otro del panel de orden); conviene dejar uno.

## 7. Que el cálculo de lotes por riesgo no asuma que todo es forex (2 SP)

**La pieza.** Al operar con "riesgo %", el backend calcula cuántos lotes abrir para que, si salta el stop, se pierda ese porcentaje del balance. Necesita la distancia al stop, el valor de un pip y, si la moneda del par no es la de la cuenta, un tipo de cambio.

**Cómo funciona hoy.** La distancia al stop se mide desde el precio actual, incluso en órdenes pendientes que se ejecutarán a otro precio. El valor del pip asume contrato de 100 000 y pip de 0,0001 (0,01 con yenes). La moneda cotizada se toma de los tres últimos caracteres del símbolo, que falla con sufijos como `.r`. Y si no encuentra un par para convertir, asume tipo de cambio 1 sin avisar.

**Qué está mal.** Con pares forex sin sufijo y conversión disponible, el resultado es correcto. Con oro, índices, símbolos con sufijo o una moneda sin par en streaming, el lote es incorrecto y nadie se entera.

**Qué se cambia.** Usar el precio de entrada de la orden pendiente como referencia. Responder con error claro ("no puedo convertir CHF a USD: no hay tick de USDCHF") en vez de asumir 1:1. Compartir la función de tamaño de pip que ya existe en otra parte del backend. Y documentar que el cálculo es solo para forex, hasta que se decida ampliarlo.

**Cómo sabremos que está bien.** Pruebas unitarias con EURUSD, USDJPY y GBPCHF en cuentas en USD y EUR, con los valores calculados a mano.

**Ojo.** Ampliar a oro e índices requiere saber el tamaño de contrato por símbolo, que el EA tendría que enviar. Es otra spec.

## 8. Saber si un broker está vivo (3 SP)

**La pieza.** Cada broker tiene su canal de precios (el pipe) y su carpeta de archivos. Si el canal no se puede abrir — por ejemplo porque un proceso antiguo se quedó con él — o el EA se desconecta, ese broker deja de emitir.

**Cómo funciona hoy.** Un fallo al abrir el canal se escribe una vez en el log y no se reintenta: el broker queda muerto hasta reiniciar el backend, mientras `/health` sigue diciendo "ok". No hay ninguna noción de "último dato recibido": la web muestra el último precio conocido aunque tenga horas. Si la carpeta del broker no existe, el fallo ni se registra.

**Qué se cambia.** Reintentar la apertura del canal con esperas crecientes. Anotar la hora del último mensaje de cada broker. Que `/health` liste cada broker con su estado y antigüedad del último dato, para que el vigilante del servidor (y el usuario) lo vean. Y registrar los errores que hoy se tragan en silencio.

**Cómo sabremos que está bien.** Parar el EA de un broker: `/health` lo marca en segundos. Bloquear el canal: el log muestra reintentos y, al liberarlo, se reconecta solo.

## 9. Consultas acotadas e índices que faltan (2 SP)

**La pieza.** La base de datos guarda millones de velas y miles de trades. Cada pantalla de la web hace consultas sobre ellas.

**Cómo funciona hoy.** Al abrir un gráfico, la consulta de medias móviles carga el histórico *completo* del símbolo (cientos de miles de velas en M5) para calcular las medias desde el principio, aunque solo se dibujen las últimas semanas. Las consultas de trades filtran por broker y fecha, pero no existe un índice combinado de esas dos columnas, así que la base de datos recorre más de lo necesario. Y quedan nombres internos heredados de tablas renombradas que la herramienta de migraciones querrá "arreglar" en el momento menos oportuno.

**Qué se cambia.** Cargar solo las velas necesarias más un margen de calentamiento (una media exponencial converge tras unas decenas de periodos; se toman diez veces el periodo lento). Añadir el índice que falta, quitar uno redundante, y una migración que renombre lo heredado.

**Cómo sabremos que está bien.** La serie de medias antes y después coincide con diferencia despreciable tras el calentamiento. `prisma migrate diff` no reporta diferencias.

## 10. Documentación veraz y código muerto fuera (3 SP)

**La pieza.** El archivo de directrices que lee cada sesión de trabajo describe cómo funciona el backend; hay otro documento de arquitectura en la carpeta del backend. Y en el código quedan restos del motor de trading eliminado hace tres semanas.

**Cómo funciona hoy.** Las directrices dicen que las posiciones se persisten desde un archivo que nadie lee, que existe un modelo de posiciones que se borró, que las órdenes llevan un campo que nunca se envía, y dedican 250 líneas a un motor y un sistema de estrategias que ya no existen. El documento de arquitectura cita módulos y variables de entorno inexistentes. En el código, un módulo de 340 líneas calcula pivotes y clasificaciones de velas en cada llamada del escáner y tira el resultado.

**Qué está mal.** Cada sesión nueva parte de una descripción falsa y puede tomar decisiones sobre ella. El código muerto cuesta tiempo de CPU y de lectura.

**Qué se cambia.** Reescribir la sección de backend de las directrices con la Parte I del informe principal; eliminar las secciones del motor (o moverlas a la carpeta de épicas si se quieren conservar como idea); actualizar el documento de arquitectura; podar el módulo a lo que se usa; completar el archivo de ejemplo de variables de entorno.

**Cómo sabremos que está bien.** Las respuestas del escáner y de niveles de setup, guardadas antes del cambio, son idénticas byte a byte después.

## 11. Red de seguridad: lint, tests y scripts (5 SP)

**La pieza.** El frontend tiene linter, formateador y comprobación de tipos. El backend no tiene nada de eso: ni linter, ni formateador, ni un solo test, ni un script de comprobación, ni versión de Node declarada.

**Qué está mal.** Cada cambio en el backend se valida solo compilando. Errores como variables calculadas y nunca usadas (hay un caso real en el escáner) pasan desapercibidos. Y sin tests, las mejoras 6, 7 y 9 —que tocan cálculos con dinero— se verifican a ojo.

**Qué se cambia.** Copiar la configuración de lint y formato del frontend adaptada a Node; añadir un ejecutor de tests; scripts `lint`, `typecheck`, `test`; declarar la versión de Node; activar las comprobaciones de código sin usar. Escribir los primeros tests sobre las piezas puras y valiosas: el cálculo de medias, la detección de cruces, las estadísticas por periodo y el tamaño de lote.

**Cómo sabremos que está bien.** Los tres comandos en verde, y el robot de GitHub los ejecuta antes de desplegar.

**Ojo.** Conviene hacerla *antes* del segundo bloque (mejoras 5–9), para que sizing y consultas se cambien con tests debajo.

---

## Cómo encajan las once

El primer bloque (1, 2, 3, 4 · 15 SP) va en este orden por una razón: la 1 hace que el proceso deje de morir, y sin eso no se puede observar nada de lo demás en producción con confianza; la 2 y la 3 son arreglos confirmados y baratos; la 4 cierra el duplicado conocido y reduce la carga de fondo que agrava todo lo anterior. Condición de cierre del bloque: una semana con cero reinicios en pm2 y cero duplicados en balances.

La 11 (herramientas) es la bisagra: hacerla justo después del primer bloque para que el segundo (5, 6, 7, 8, 9 · 15 SP) —que toca el WS, las órdenes y las consultas— tenga tests debajo. Dentro del segundo bloque el orden importa poco, salvo que la 6 y la 7 (órdenes y lotes) se prueben en demo.

La 10 (docs) es oportunista, pero conviene no dejarla para el final: cada sesión de trabajo hasta entonces leerá una descripción falsa.

Fuera del plan, con spec propia cuando toque: unificar los tiempos a UTC. Es el cambio más profundo que ha salido de la auditoría, y también el que más decisiones de producto necesita.
