# 030 — Reflejo rápido de los trades cerrados

> Estado: **cerrada**

## Contexto
Una posición cerrada tarda hasta ~90 s en llegar a la base de datos y nunca llega sola a una página abierta. El EA escribe `history.json` cada `STATE_EVERY_S` (60 s), el file watcher del backend lo lee cada 30 s, y las páginas de Historial (posiciones cerradas del journal) y Stats solo cargan al montarse o al cambiar filtros: no hay señal por WS para los trades cerrados. Las posiciones abiertas, en cambio, llegan por el pipe cada segundo, así que una posición cerrada desaparece al instante pero aparece en Historial/Stats mucho después.

## Capas afectadas
- ea · backend · frontend

## Historias de usuario
- Como operador, quiero que una posición que cierro aparezca en Historial y Stats en pocos segundos, para revisar el resultado al momento.
- Como operador, quiero que una página de Historial o Stats abierta se refresque sola cuando llegan trades cerrados nuevos, para no tener que recargar.

## Criterios de aceptación
- CA 1. CUANDO cambia el historial de cuenta de un terminal (se cierra un trade, se registra una operación de balance) ENTONCES el EA escribe `history.json` sin esperar al ciclo de estado de 60 s, como mucho una vez cada 3 s.
- CA 2. CUANDO no cambia nada en el historial de cuenta ENTONCES el EA sigue escribiendo `history.json` solo en su ciclo normal de 60 s.
- CA 3. El file watcher del backend sondea los ficheros del bridge cada 5 s; los ficheros sin cambios se saltan: las velas como hoy y ahora también `history.json` y `account.json` (por `mtime`/tamaño y contenido), así que dejan de tocar la BD en cada vuelta.
- CA 4. CUANDO el watcher procesa un `history.json` modificado de un broker ENTONCES el backend emite `{ type: "trades_updated", broker }` por `/ws` después de guardar las filas.
- CA 5. CUANDO una página de Historial o Stats abierta recibe `trades_updated` de un broker que está mostrando (o de cualquiera si muestra todos) ENTONCES vuelve a pedir sus datos una vez, con debounce, conservando los filtros y sin parpadeo de carga.
- CA 6. CUANDO se cierra una posición en producción ENTONCES aparece en una página de Historial y Stats abierta en ~10 s sin recargar.
- CA 7. Los mensajes WS existentes y el contrato de ficheros EA ↔ backend no cambian; `trades_updated` es aditivo.

## Fuera de alcance
- Enviar los trades cerrados uno a uno por WS (la página vuelve a pedir la API).
- Cambiar el ciclo de 60 s de las velas o de `account.json`.
- Que otras páginas (dashboard, chart) reaccionen a `trades_updated`.
