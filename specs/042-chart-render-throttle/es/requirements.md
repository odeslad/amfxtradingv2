# 042 — Limitación del repintado del chart

> Status: **approved**

## Contexto

Con la página del chart abierta y quieta, el hilo principal del navegador está ocupado casi todo el tiempo. Un perfil de 10 s de DevTools Performance en producción (2026-11-11, ya con la spec 041 recortando el volumen del WebSocket) muestra ≈ 3,9 s de Paint (47 %) y ≈ 3,2 s bajo "Animation frame fired" (38 %), el resto casi todo render de lightweight-charts; el usuario ve ≈ 25 % más de CPU con el chart visible. Dos causas en `features/chart`: (1) cada tick (10 por segundo) aplica la vela viva y una actualización por EMA a lightweight-charts, y cada una dispara un repintado completo del chart; (2) un bucle `requestAnimationFrame` permanente en `LightweightChart` (y un segundo en `DrawingTools` mientras hay dibujos) corre 60 veces por segundo calculando firmas precio→píxel de posiciones y alertas, y como el eje de precio autoescalado se mueve un poco en casi cada tick, repinta el overlay entero (líneas de rollover con un recorrido de todas las velas por línea, marcadores de alertas, trades de cruce de EMA) hasta diez veces por segundo. La vista dividida lo duplica todo.

Esta spec hace que el chart se repinte solo cuando algo visible cambie y a un ritmo acotado, sin cambio visual para el usuario.

## Capas afectadas

- frontend

## Historias de usuario

- Como trader, quiero que la página del chart deje de quemar CPU mientras está quieta, para que el portátil se mantenga frío y silencioso y la batería dure.
- Como trader, quiero que la vela viva, las EMAs, las líneas de spread, los marcadores de alertas, las etiquetas de posición y los trades de cruce de EMA se vean y se muevan exactamente como hoy, para que la optimización sea invisible.
- Como trader con la app en una pestaña en segundo plano, quiero que no haga nada hasta que vuelva, para que no compita con lo que estoy haciendo.

## Criterios de aceptación

- AC 1. CUANDO llegan ticks del par del chart ENTONCES la vela viva y las EMAs se aplican al chart como máximo una vez por frame de animación y como máximo cada 250 ms, con los valores del último tick; entre aplicaciones, el tick más nuevo sustituye al pendiente.
- AC 2. CUANDO el chart está quieto (sin tick, scroll, zoom, redimensionado ni interacción del usuario) ENTONCES no hay ningún callback de `requestAnimationFrame` de `features/chart` programado y el overlay no se repinta.
- AC 3. CUANDO se aplica un tick, cambia el rango visible o se redimensiona el contenedor ENTONCES las etiquetas de posición y los marcadores de alertas se recolocan si, y solo si, su posición en píxeles cambió, exactamente como hace el bucle actual.
- AC 4. CUANDO existen dibujos (líneas de tendencia, rectángulos, Fibonacci, regla) ENTONCES siguen a la escala de precio en esos mismos eventos sin bucle continuo.
- AC 5. CUANDO el overlay necesita repintarse ENTONCES las líneas de rollover se calculan a partir de un índice tiempo→vela construido una vez por repintado, no recorriendo todas las velas por línea, y el resultado pintado es idéntico.
- AC 6. CUANDO la pestaña del navegador está oculta ENTONCES las actualizaciones pendientes del chart se descartan y no se pinta nada; CUANDO vuelve a estar visible ENTONCES el siguiente tick (o el último pendiente) repinta el chart dentro de un intervalo.
- AC 7. CUANDO se graba el mismo perfil de 10 s en reposo en producción tras el deploy ENTONCES Paint y "Animation frame fired" quedan cada uno por debajo de un tercio de las cifras del 2026-11-11 (≈ 1,3 s y ≈ 1,1 s), y la vela viva, EMAs, spread, alertas, etiquetas de posición, dibujos y trades de cruce de EMA se comportan como antes en escritorio y móvil, vista simple y dividida.

## Fuera de alcance

- Reducir el número o tamaño de las capas de canvas (chart, escalas, overlay, dibujos).
- Cambiar opciones o versión de lightweight-charts.
- Limitar nada fuera de la página del chart (posiciones, cuentas, volumen del WebSocket: ver spec 041).
- Cualquier cambio visual.
