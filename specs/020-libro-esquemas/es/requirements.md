# 020 — Libro de esquemas EURUSD

> Estado: **aprobada**

## Contexto

El operador lleva a mano un backtest de su sistema de esquemas EURUSD H1 en `data/esquemas y operaciones
EURUSD.html`: una página estática con los datos embebidos (878 operaciones y 454 esquemas de 2015-02 a
2026-09) y una tabla de esquemas con totales arriba. Es **informativo**: le dice dónde está el sistema en
EURUSD y no tiene nada que ver con la operativa real de la app. Quiere ese libro dentro de la web, con la
misma lectura (totales, esquemas, sus operaciones) y poder mantenerlo al día a mano: crear, editar y borrar
esquemas y operaciones. El libro no toca brokers, posiciones ni trades de la app.

Cada cifra de una operación se deriva de sus precios y del saldo acumulado, exactamente como hace el
documento: la cuenta empieza en 10 000; lotes = 1 % del saldo previo a la operación ÷ (distancia del SL en
pips × 10), redondeado a 0,01; resultado en € = lotes × pips ganados × 10; R = resultado ÷ (1 % del saldo
previo); saldo después = saldo previo + resultado. El resumen de un esquema (línea de trades, tickets, neto €
y neto R) y los totales de la cabecera salen de sus operaciones.

## Capas afectadas

- db
- backend
- frontend

Sin cambio de EA, sin dependencias nuevas.

## Historias de usuario

- Como trader, quiero el libro de esquemas en la web con la misma tabla y totales que mi documento, para ver
  dónde está el sistema sin abrir el fichero.
- Como trader, quiero añadir las operaciones de un esquema nuevo tecleando solo precios, fechas y la nota,
  para que lotes, €, R y saldo se calculen igual que en el backtest.
- Como trader, quiero corregir o borrar cualquier esquema u operación, para que el libro siga siendo mío.
- Como trader, quiero importar el documento una vez para no volver a teclear once años de operaciones.

## Criterios de aceptación

- AC 1. CUANDO se ejecuta el script de importación con la ruta del documento ENTONCES `book_schemes` y
  `book_trades` contienen todos los esquemas y operaciones del fichero (número, inicio, fin, resultado;
  ticket, esquema, posición, dirección, lotes, entrada, SL, apertura, cierre, precio de cierre, resultado €, R,
  saldo después, nota), la ejecución es idempotente (una segunda no cambia nada) e informa de los recuentos y
  de la primera discrepancia entre las cifras guardadas del fichero y las recalculadas, si la hay.
- AC 2. CUANDO se llama a `GET /book/schemes?year=YYYY|all&page=N&pageSize=25|50|100` ENTONCES devuelve esa
  página de los esquemas del más nuevo al más antiguo (más `total` y `years`) con, por esquema, el resumen
  calculado (línea `trades` como `T1 -1.0 · T2 +3.7`, `tickets`,
  `netEur`, `netR`) y sus operaciones, más los totales de la selección (esquemas, ganados, empates, perdidos,
  % ganados, neto €, neto R).
- AC 3. CUANDO se llama a `POST /book/schemes` con `{ number, start, end?, result?, note? }` ENTONCES se crea el
  esquema (409 con número duplicado) con `result` `auto` por defecto; `PUT /book/schemes/:id` edita esos campos; `DELETE /book/schemes/:id`
  elimina el esquema y sus operaciones.
- AC 4. CUANDO se llama a `POST /book/trades` con `{ schemeId, slot, direction, entry, sl, openTime, closeTime?,
  closePrice?, note? }` ENTONCES la operación recibe el siguiente número de ticket y sus lotes se calculan desde
  el saldo de la operación cerrada anterior (por ticket); CUANDO tiene hora y precio de cierre ENTONCES se
  calculan también pips, resultado €, R y saldo después; CUANDO no los tiene ENTONCES está **en curso**: sin pips,
  € ni R, y no mueve la cadena de saldo hasta que cierre; `PUT /book/trades/:id`
  edita esas entradas y recalcula la operación **y todas las posteriores** (la cadena de saldo); `DELETE
  /book/trades/:id` la elimina y recalcula las posteriores.
- AC 5. CUANDO el resultado de un esquema es `auto` (el valor por defecto) ENTONCES lo definen sus operaciones:
  `Pendiente` mientras el esquema no tenga fecha de fin, no tenga operaciones o tenga una operación en curso (en curso, contado aparte en los
  totales, nunca como ganado ni perdido); con fecha de fin, la posición de la operación que alcanzó su objetivo
  (`T1` / `T2` / `T3` / `RE`), `Pierde` cuando todas perdieron, `Empate` cuando la R neta queda dentro de
  ±0,5. Un resultado tecleado a mano (las cinco excepciones del documento) sustituye al automático.
- AC 6. CUANDO el usuario abre **Schemas** (entrada de navegación, ruta `/schemas`) ENTONCES la página muestra la cabecera de
  totales (esquemas, ganados, empates, perdidos, % ganados, neto €, neto R), un filtro por año y la tabla de
  esquemas con las columnas del documento (esq., inicio, fin, trades, tickets, resultado, neto €, neto R),
  **paginada** (25 / 50 / 100 por página, anterior / siguiente, "1–25 de 454"); un
  esquema se expande a sus operaciones (ticket, posición, dirección, lotes, entrada, SL, apertura, cierre,
  precio de cierre, €, R, saldo, nota; una operación en curso muestra "en curso" en lugar de sus cifras de
  cierre); tabla en escritorio, tarjetas en móvil.
- AC 7. CUANDO el usuario pulsa **Nuevo esquema** o **Editar** / **Eliminar** en un esquema, o **Nueva
  operación** dentro de un esquema o **Editar** / **Eliminar** en una operación ENTONCES un panel lateral con
  los campos del AC 3 / AC 4 hace la llamada, las cifras calculadas se previsualizan antes de guardar y la
  tabla se actualiza sin recargar; los borrados piden confirmación.
- AC 8. CUANDO la implementación está completa ENTONCES `npm run build` y `npm test` pasan en `backend/`
  (vitest sobre los cálculos puros: lotes, pips, €, R, cadena de saldo, resultado y resumen del esquema) y
  `npm run build` + `npm run lint` pasan en `frontend/`; la importación del documento real coincide con sus
  cifras guardadas.

## Fuera de alcance

- Cualquier vínculo entre el libro y la operativa real (brokers, posiciones, órdenes, alertas).
- Gráficos, estadísticas más allá de los totales de cabecera y exportaciones.
- Otros símbolos (el libro es solo EURUSD).
