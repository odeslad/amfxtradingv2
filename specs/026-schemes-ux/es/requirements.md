# 026 — Página de esquemas: UX en móvil y escritorio

> Estado: **aprobada**

## Contexto

La página de Esquemas (el libro manual de esquemas del operador, spec 020) funciona pero se lee mal. En
el teléfono las cards de esquema usan texto de 12–13 px, las acciones son enlaces de texto de 9 px, los
siete tiles de totales ocupan media pantalla, la fila de paginación no cabe y las operaciones de un
esquema no se pueden editar ni borrar (la card abierta solo las lista). En escritorio la tabla de
operaciones tiene 15 columnas y hace scroll lateral, las acciones de fila son enlaces grises tenues y la
cabecera (título grande + selector de año) difiere del resto de la app. Esta spec rehace solo la
disposición: el modelo de datos, los cálculos de R / saldo, la API y los textos en español de la página
quedan como están.

## Capas afectadas

- frontend

## Historias de usuario

- Como operador en el teléfono, quiero leer el resultado de un esquema de un vistazo y abrir sus
  operaciones como cards igual que Positions, para revisarlas y corregirlas sin el escritorio.
- Como operador en escritorio, quiero una cabecera, unos totales y una tabla de operaciones compactos,
  para que el esquema entero quepa en pantalla sin scroll lateral.

## Criterios de aceptación

- CA 1. CUANDO se abre la página ENTONCES la cabecera es una barra de pestañas como la del Journal con una
  pestaña por año más **Todos**, la activa en azul, y un botón verde contorneado **+ Nuevo esquema** a la
  derecha (escritorio); en el teléfono las pestañas ocupan el ancho y el botón va debajo a ancho completo,
  de 44 px de alto.
- CA 2. CUANDO se muestran los totales en escritorio ENTONCES son una franja con separadores: Esquemas
  (con "· N en curso"), Ganados, Empates, Perdidos, % ganados, y Neto € y Neto R más grandes a la derecha.
  En el teléfono son un bloque: un título pequeño "N esquemas · M en curso", Neto € (22 px) y Neto R
  (28 px) en dos columnas, y Ganados / Empates / Perdidos / % ganados en cuatro columnas iguales con
  etiqueta bajo un separador.
- CA 3. CUANDO se muestra una fila de esquema en escritorio ENTONCES sus columnas son: chevron, Esq.,
  Inicio → Fin (una columna), Operaciones, Resultado, Neto €, Neto R; los botones **Editar** (naranja) /
  **Eliminar** (rojo) de 27 px no ocupan columna: las columnas de datos se estiran hasta el borde derecho
  y los botones entran deslizándose sobre el extremo derecho de la fila al pasar el ratón, exactamente
  como las filas de Positions del Journal.
- CA 4. CUANDO se despliega un esquema en escritorio ENTONCES su tabla de operaciones tiene solo Pos.,
  Dir., Lotes, Entrada, Cierre, Apertura → Cierre, Pips, €, R, Saldo, con los mismos Editar / Eliminar al
  pasar el ratón del CA 3;
  ticket, SL y nota se ven solo en el panel de edición; **+ Nueva operación** sigue en la cabecera del
  bloque.
- CA 5. CUANDO se muestra el resultado de un esquema u operación (En curso, Ganado, Perdido, Empate)
  ENTONCES es texto en mayúsculas de su color sin borde ni fondo, para que nunca parezca un botón.
- CA 6. CUANDO se muestra la lista de esquemas en el teléfono ENTONCES cada card cerrada tiene ▸ #número,
  el resultado y tres valores con etiqueta en columnas iguales: Inicio, Neto €, Neto R (Neto R a 28 px,
  como el P&L de Positions; el resto a 15 px), con el borde izquierdo del color del resultado.
- CA 7. CUANDO el operador toca una card en el teléfono ENTONCES se despliega (▾) en una rejilla con
  etiquetas (Inicio, Fin, Neto €, Neto R a 28 px), un botón **Ver operaciones** (número en una pastilla,
  "N en curso" y › a la derecha, en una línea) y tres botones de 44 px: **+ Operación**, **Editar**,
  **Eliminar**.
- CA 8. CUANDO el operador toca Ver operaciones ENTONCES un panel a pantalla completa ("Operaciones ·
  esquema N", ✕) lista las operaciones del esquema en el formato de card de Positions: un resumen con las
  etiquetas Posición / Entrada / R sobre los valores (R a 28 px); un toque lo despliega (borde izquierdo
  azul) en una fila por campo (Lotes, Cierre, SL, Pips, €, Saldo, Apertura, Cierre, Ticket, Nota); un
  deslizamiento a la izquierda muestra **Editar** (naranja) y **Eliminar** (rojo) sobre la columna R; al
  pie va un botón naranja de 48 px **+ Nueva operación**. Editar abre el panel de operación existente,
  Eliminar la confirmación existente.
- CA 9. CUANDO se muestra la paginación en el teléfono ENTONCES son botones ‹ y › de 44 px en los extremos
  con "página / páginas · N por pág." en el centro; el escritorio conserva el texto de rango y añade
  botones ‹ › compactos.
- CA 10. CUANDO se crea, edita o borra una operación o un esquema desde cualquiera de estos sitios ENTONCES
  la lista, los totales y el panel abierto se refrescan como hoy.

## Fuera de alcance

- El modelo de datos, las reglas de R / saldo y la API `/book`.
- Traducir la página al inglés.
- Los propios paneles de edición de esquema y operación (mantienen sus campos y disposición).
