# 022 — Eliminar la sección Scanner

> Estado: **cerrada**

## Contexto

La página Scanner (`/scanner`) lista, para un broker y un timeframe, la situación de cruce de EMAs de
cada símbolo (imminent / crossed, gap, convergencia, ETA, distancia en vivo, últimos cruces con MFE /
MAE). Se sustituirá por otra sección, aún sin especificar, así que se retira ahora en vez de quedar como
interfaz sin uso. El scanner no recoge ni guarda nada: cada petición recalcula desde las velas que ya
están en la base de datos, así que quitarlo no pierde datos. Lo que lee se queda: las velas, el detector
de EMAs / cruces de `backend/src/indicators/`, los niveles de setup que usa el panel New Trade y las
alertas EMA. El código retirado queda en el historial de git (último cambio en `673a569`) para la
sección que lo sustituya.

## Capas afectadas

- frontend · backend

## Historias de usuario

- Como operador, quiero el Scanner fuera de la navegación y de la app, para que la interfaz solo muestre
  secciones en uso mientras se diseña la sustituta.
- Como operador, quiero que los niveles de New Trade y las alertas EMA sigan funcionando exactamente como
  hoy, para que quitar la página no tenga efectos sobre la operativa.

## Criterios de aceptación

- CA 1. CUANDO carga la app ENTONCES la navegación no tiene entrada Scanner (Journal, Chart, Stats,
  Schemas, Settings), en escritorio y en la barra móvil, y `/scanner` cae en la ruta por defecto de la app.
- CA 2. CUANDO se llama a `GET /scanner` ENTONCES el backend responde 404 como a cualquier ruta
  desconocida; el recuento de routers en la documentación baja a 16.
- CA 3. CUANDO se abre el panel New Trade ENTONCES `GET /setup-levels` sigue devolviendo los niveles del
  último setup y el panel los muestra con sus distancias, como antes.
- CA 4. CUANDO hay una alerta de cruce de EMAs configurada ENTONCES sigue evaluándose y disparándose como
  antes.
- CA 5. CUANDO se compilan frontend y backend ENTONCES nada referencia los ficheros retirados: ni
  `ScannerPage`, ni `useScanner`, ni `routes/scanner`, ni `services/scanner`, ni `IconScanner`; lint limpio.
- CA 6. CUANDO se leen `backend/docs/architecture.md` y `.claude/CLAUDE.md` ENTONCES el scanner ya no
  aparece en la lista de routers, el árbol ni la tabla de endpoints.

## Dónde encontrar el código retirado más adelante

Último commit con el scanner antes de esta spec: el padre del commit de retirada (`git show d3ee654^:frontend/src/features/scanner/ScannerPage.tsx`, `git show 6908fb4^:backend/src/services/scanner.ts`). Ficheros: `backend/src/services/scanner.ts` (por símbolo y dirección: estado imminent / crossed / na según el gap de EMAs y su convergencia por vela, ETA en velas y ms, velas desde el último cruce, cierre de activación para la distancia en vivo, últimos 10 cruces con MFE / MAE en pips mediante `detectEmaCrossSetups`), `backend/src/routes/scanner.ts` (`GET /scanner?broker&tf&emaFast&emaSlow`), `frontend/src/lib/useScanner.ts`, `frontend/src/features/scanner/ScannerPage.tsx` + `.module.css` (dos tablas BUYS / SELLS, color por RR rojo < 1 / naranja 1–2 / verde > 2, círculos de cruce dimensionados por MFE, distancia en vivo desde el mensaje WS `ticks`). Las piezas que usaba siguen en el repo: `indicators/ema.ts`, `indicators/ema-cross.ts`, `indicators/pip-size.ts`, `indicators/timeframe.ts`.

## Fuera de alcance

- La sección que sustituye al scanner (spec propia).
- Cualquier cambio en `indicators/`, `/setup-levels`, las alertas EMA o las tablas de velas.
- Retirar `getPipSize` o las herramientas de EMA del gráfico.
