# 023 — Notificaciones de cruce de EMAs en Settings

> Estado: **aprobada**

## Contexto

Hoy el único aviso de EMAs es la alerta de un solo disparo que se crea desde el panel Alerts del
gráfico: un broker, un par, un timeframe, se dispara una vez cuando las EMAs convergen dentro de un
umbral y se desactiva sola. El operador quiere un **notificador** configurado desde Settings: reglas
permanentes que vigilan cruces de EMAs en uno o varios pares y timeframes, avisan de cruces confirmados
y / o de un cruce que se acerca bajo un umbral de pips, para cruces alcistas, bajistas o ambos, pueden
repetirse cada N minutos mientras dure la situación, pueden tener hora de fin, y llegan al operador por
Web Push. Las alertas del gráfico se quedan como están. Settings recibe además una nueva disposición para
escritorio y móvil al añadir el bloque de Notificaciones, con la activación del push trasladada ahí desde
el gráfico.

Las velas viven por broker, así que una regla nombra el broker cuyas velas lee. En el futuro próximo solo
importa EURUSD, pero una regla puede apuntar a una lista de pares o a todos los del broker.

## Capas afectadas

- frontend · backend · db

## Historias de usuario

- Como operador, quiero definir notificaciones de cruce de EMAs desde Settings, para que me avisen de los
  cruces que me interesan sin abrir un gráfico por cada par.
- Como operador, quiero que una notificación se repita cada N minutos mientras las EMAs sigan
  convergiendo o cruzadas, y que se detenga sola a una hora dada, para que se ajuste a una sesión en vez
  de dispararse una vez.
- Como operador, quiero elegir cruces alcistas, bajistas o ambos, un par o un grupo, y el cruce
  confirmado y / o su anticipación, para que una regla corresponda a una forma de operar.
- Como operador, quiero que Settings sea cómodo en escritorio y en el móvil, para gestionar el mirror,
  la visualización y las notificaciones desde cualquiera.

## Criterios de aceptación

- CA 1. CUANDO se abre Settings ENTONCES muestra tres pestañas — **Mirror**, **Display**,
  **Notifications** — con la misma barra de pestañas que el Journal; Mirror y Display conservan sus campos
  y comparten un único **Save**; la página usa todo el ancho de contenido en escritorio y los tamaños del
  formulario de New Trade en móvil.
- CA 2. CUANDO se abre la pestaña Notifications ENTONCES su barra muestra **Devices** (con el número de
  dispositivos suscritos) junto a **+ New notification**; Devices abre un panel lateral con las
  suscripciones push del usuario (navegador y sistema detectados al suscribir, fecha, último push, "this
  device" marcado) con Remove por fila, y una caja **Enable this device** cuando el dispositivo actual no
  está suscrito (el control que hoy tiene el panel Alerts del gráfico, trasladado aquí). El cuerpo de la
  pestaña es la lista de notificaciones del usuario: nombre / pares, timeframe, par de EMAs, evento, dirección,
  repetición, fin, estado (activa, pausada, terminada) y última vez disparada, con un toggle, Edit y Delete
  por fila (tabla en escritorio, tarjetas en móvil).
- CA 3. CUANDO se pulsa **New notification** ENTONCES un panel lateral pide: broker (velas de referencia),
  pares (todos los que opera el broker, como chips en filas de cinco, seleccionables uno o varios, más "todos los pares del broker"), timeframe (M5 / M15 / H1 / H4 / D1), EMA rápida y lenta,
  evento (cruce confirmado, cruce que se acerca bajo N pips, o ambos), dirección (alcista, bajista,
  ambas), repetición (una vez por evento, o cada N minutos mientras dure), fin (fecha y hora opcionales),
  nota; Save la crea activa. Edit abre el mismo panel relleno.
- CA 4. CUANDO cierra una vela del timeframe de una regla en un par vigilado ENTONCES el backend evalúa la
  regla sobre las velas cerradas: un **cruce confirmado** es la EMA rápida cambiando de lado respecto a la
  lenta en esa vela; un **cruce que se acerca** es el gap encogiéndose y dentro del umbral; se aplica el
  filtro de dirección; una regla que coincide notifica por Web Push y por un mensaje WebSocket que la app
  muestra como toast.
- CA 5. CUANDO una regla se repite cada N minutos ENTONCES tras una notificación el mismo par / timeframe
  se notifica de nuevo en el primer cierre de vela en que la situación siga y hayan pasado al menos N
  minutos; una regla "una vez" notifica una sola vez por evento (un cruce confirmado una vez por vela de
  cruce; una aproximación una vez hasta que el gap sale del umbral o ocurre el cruce).
- CA 6. CUANDO pasa la hora de fin de una regla ENTONCES deja de evaluarse y se muestra como terminada;
  CUANDO su toggle está apagado ENTONCES está pausada y no dispara nada.
- CA 7. CUANDO el usuario no tiene suscripción push ENTONCES el bloque Devices lo indica y las reglas
  siguen disparando en la app (toast) para no perder nada en la sesión abierta; CUANDO se quita un
  dispositivo ENTONCES deja de recibir pushes de inmediato.
- CA 8. CUANDO se edita el % de riesgo del Mirror (o cualquier campo decimal de Settings) en el móvil ENTONCES el teclado ofrece el separador decimal y el valor conserva sus decimales (hoy el teclado del iPhone no lo tiene).
- CA 9. CUANDO se usa el panel Alerts del gráfico ENTONCES sus alertas de precio y de EMA funcionan
  exactamente como antes.

## Fuera de alcance

- Email o cualquier canal distinto de Web Push y el toast en la app.
- Retirar o cambiar las alertas EMA de un solo disparo del gráfico.
- Notificaciones de otra cosa que no sean cruces de EMAs (los niveles de precio conservan sus alertas).
- Evaluar entre cierres de vela (ticks en vivo); las repeticiones se comprueban en los cierres.
