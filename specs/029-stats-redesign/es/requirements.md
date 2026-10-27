# 029 — Rediseño de Stats y filtro por activo

> Estado: **borrador**
> Maqueta: [Stats rediseño](https://claude.ai/artifact/VDb9ZAGrZJw5TcxNwtzCrU) (aprobada)

## Contexto

La página de Stats (`frontend/src/features/stats/`) filtra por broker y periodo (el `DATE_RANGE_OPTIONS` del Journal en un select) y muestra seis recuadros de KPIs, la tabla mensual y la curva de balance. No se puede filtrar por activo, la lista de periodos no encaja con cómo el operador revisa resultados (ventanas móviles) y el diseño difiere del resto de la app (franja de totales de Esquemas, pestañas + menú "Más").

## Capas afectadas

- backend (filtro opcional `symbol` en `GET /stats`, activos operados por broker)
- frontend (Stats y la lista de periodos del Journal)

## Historias de usuario

- Como trader, quiero filtrar las stats por activo, para ver cómo rinde cada par.
- Como trader, quiero periodos móviles (hoy, ayer, 7/30/90/365 días, todo, custom), para que las cifras encajen con cómo reviso resultados.
- Como trader, quiero que la página de Stats se vea como el resto de la app en escritorio y móvil.

## Criterios de aceptación

**Filtro de periodo (Stats y Journal)**
- AC 1. Pestañas **Hoy**, **Ayer**, **Esta semana** (últimos 7 días), **Este mes** (últimos 30 días) y **Más ▾**, que abre el menú propio de la app con **Este trimestre** (últimos 90 días), **Este año** (últimos 365 días), **Todo** y **Custom**. En móvil las pestañas son Hoy · Ayer · Semana · Mes · Más ▾.
- AC 2. CUANDO está activa una opción de "Más" ENTONCES la pestaña mantiene el texto "Más ▾" y se marca como activa (azul).
- AC 3. CUANDO se elige Custom ENTONCES aparecen los campos Desde/Hasta; la fecha Hasta no puede ser posterior a hoy.
- AC 4a. El Journal usa la misma lista de periodos y los mismos límites en el select de su panel de filtros (Hoy, Ayer, Esta semana, Este mes, Este trimestre, Este año, Todo, Custom); un periodo guardado del Journal/Stats que ya no existe vuelve a Todo.
- AC 4. Las ventanas móviles terminan ahora y empiezan N días antes del inicio de hoy (7 días = hoy y los 6 anteriores).

**Filtro por activo**
- AC 5. Un select **Activo** junto a Broker lista "Todos" más los símbolos operados en ese broker, sin los símbolos ocultos (visibilidad de la spec 024).
- AC 6. CUANDO se elige un activo ENTONCES trades, ganadas, win rate, trades/mes, Net P&L y las filas mensuales cuentan solo las operaciones de ese activo.
- AC 7. CUANDO se elige un activo ENTONCES Cash flow y Return muestran "—" y el gráfico muestra el P&L acumulado de ese activo; con "Todos" el gráfico es la curva de balance como hoy.
- AC 8. CUANDO cambia el broker y el activo elegido no se operó en él ENTONCES el activo vuelve a "Todos".

**Diseño**
- AC 9. Escritorio: barra de filtros (pestañas de periodo a la izquierda, Broker y Activo a la derecha); franja de totales como en Esquemas (Trades, Win rate, Trades/mes, Cash flow a la izquierda; Return y Net P&L en grande a la derecha); debajo, el gráfico (2/3 del ancho) y la tabla mensual (1/3) con columnas Mes, Trades, Win %, Net P&L. El gráfico ocupa todo el alto restante de la ventana hasta el final de la página; la tabla mensual hace scroll dentro de su columna cuando es más alta.
- AC 10. Móvil: selects Broker y Activo uno al lado del otro; las pestañas de periodo; un bloque de totales (Net P&L y Return en grande, luego Trades, Win rate, T/mes, Cash flow); el gráfico; los meses como tarjetas (mes + trades, win %, net).
- AC 11. Los filtros (incluido el activo) se guardan por dispositivo como hoy (`localStorage`).

## Fuera de alcance

- El diseño de pestañas + "Más" en el Journal (mantiene su select dentro del panel de filtros).
- Varios activos a la vez.
- Métricas nuevas aparte del win % mensual.
