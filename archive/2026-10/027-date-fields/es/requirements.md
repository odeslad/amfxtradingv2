# 027 — Un único campo de fecha para toda la app

> Estado: **cerrada**

## Contexto

La app tiene nueve campos de fecha en cinco sitios y cada uno se comporta distinto: el panel de operación de
los esquemas (Apertura, Cierre) y el panel de notificación EMA (Ends) son texto libre en el que el operador
escribe a mano las barras y los dos puntos; el panel de esquema (Inicio, Fin) y los filtros de rango
personalizado del Journal y de Stats (Desde, Hasta) usan el selector de fecha nativo del navegador, que se ve
y formatea distinto en el iPhone y en el PC. El operador quiere un formato único en todas partes,
`DD/MM/YYYY HH:MM` para fecha y hora y `DD/MM/YYYY` para fecha, rellenado tecleando solo dígitos
(`121020261400` → `12/10/2026 14:00`), más un calendario propio de la app para elegir un día.

## Capas afectadas

- frontend

## Historias de usuario

- Como operador, quiero escribir una fecha con dígitos y verla formateada mientras escribo, para que meter
  horas en el móvil o en el PC sea rápido e idéntico.
- Como operador, quiero un calendario que se vea igual en todos los dispositivos, para elegir un día sin
  tener que recordarlo.

## Criterios de aceptación

- CA 1. CUANDO se muestra cualquiera de los nueve campos de fecha (Apertura / Cierre de la operación de
  esquema, Inicio / Fin del esquema, Ends de la notificación EMA, Desde / Hasta de los filtros del Journal,
  Desde / Hasta de los filtros de Stats) ENTONCES es el mismo `DateField` compartido, en modo `datetime`
  (`DD/MM/YYYY HH:MM`) o `date` (`DD/MM/YYYY`), con ese patrón como placeholder; no queda ningún selector de
  fecha nativo.
- CA 2. CUANDO el operador escribe ENTONCES solo se conservan los dígitos y los separadores se insertan
  sobre la marcha: `/` tras el día y el mes, un espacio tras el año y `:` tras la hora (`121020261400` →
  `12/10/2026 14:00`; `12102026` → `12/10/2026` en modo fecha); los dígitos de más se ignoran; el teléfono
  muestra el teclado numérico.
- CA 3. CUANDO el operador borra ENTONCES borrar un separador se lleva el dígito anterior, así la tecla de
  borrar nunca se atasca; CUANDO el operador pega una fecha con o sin separadores ENTONCES se reformatea
  igual.
- CA 4. CUANDO el campo tiene un valor completo que no es una fecha u hora real (31/02/2026, 25:00) ENTONCES
  su borde pasa a rojo y el formulario no se envía, con el toast de error actual del formulario; un valor
  incompleto cuenta como vacío donde el campo es opcional y como error donde es obligatorio.
- CA 5. CUANDO el operador pulsa el icono de calendario a la derecha del campo ENTONCES se abre el calendario
  propio de la app (escritorio: un desplegable bajo el campo; teléfono: un panel inferior con días de 44 px):
  mes y año con flechas ‹ ›, semanas que empiezan en lunes, el día elegido en naranja, hoy con borde azul, un
  botón **Hoy**, y en modo fecha y hora un campo de hora `HH:MM` que se formatea solo como el campo
  principal. El desplegable de escritorio queda siempre dentro del área visible con al menos 8 px de margen:
  se alinea por defecto con el borde izquierdo del campo, con su borde derecho cuando el campo está cerca del
  lado derecho de la pantalla o de un panel lateral, y se abre por encima del campo cuando no cabe debajo.
- CA 6. CUANDO se elige un día ENTONCES el campo lo muestra (conservando la hora escrita, o `00:00` si no hay
  en modo fecha y hora); el modo fecha cierra el calendario, el modo fecha y hora lo mantiene abierto para la
  hora (teléfono: **Aceptar** lo cierra); CUANDO se escribe una fecha completa ENTONCES el calendario se abre
  en ese mes.
- CA 7. CUANDO un formulario se envía ENTONCES cada campo envía exactamente lo que envía hoy (el libro de
  esquemas conserva sus horas "tal cual se escriben", la notificación EMA conserva la hora local, los filtros
  conservan sus límites `YYYY-MM-DD`), así que el backend y los valores guardados no cambian.
- CA 8. CUANDO un campo ya tiene valor (al editar un esquema, una operación o una notificación; al reabrir un
  filtro) ENTONCES muestra ese valor en el formato nuevo.

## Fuera de alcance

- Cómo se muestran las fechas fuera de los campos (tablas, cards, toasts); una spec posterior puede
  unificarlas.
- Zonas horarias y cómo interpreta cada campo su valor.
- Rangos de fechas en un solo control (Desde / Hasta siguen siendo dos campos).
