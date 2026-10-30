# 034 — Candado del gráfico

> Estado: **borrador**

## Contexto
En el gráfico, los dibujos (líneas, rectángulos, marcadores, símbolos, textos), las líneas de posiciones y órdenes (entrada, SL, TP) y las alertas de precio reaccionan al ratón. Cuando el usuario hace zoom o desplaza el gráfico y el puntero empieza sobre uno de ellos, ese elemento se selecciona o se arrastra en lugar de moverse el gráfico, y luego hay que corregirlo. No hay forma de hacer que estos elementos ignoren el ratón.

## Capas afectadas
- frontend

## Historias de usuario
- Como trader, quiero un botón de candado en el gráfico, para hacer zoom y desplazarme sin mover sin querer dibujos, posiciones, órdenes ni alertas.
- Como trader, quiero que el candado se recuerde, para no tener que activarlo cada vez que abro el gráfico.

## Criterios de aceptación
- AC 1. CUANDO el usuario pulsa el botón de candado de la barra del gráfico ENTONCES el candado se activa y el botón muestra su estado activo; al pulsarlo de nuevo se desactiva.
- AC 2. CUANDO el candado está activo ENTONCES pulsar o arrastrar un dibujo no lo selecciona ni lo mueve, y el gesto hace zoom / desplaza el gráfico como si el dibujo no estuviera.
- AC 3. CUANDO el candado está activo ENTONCES las líneas de entrada, SL y TP de posiciones y órdenes pendientes no se pueden arrastrar ni editar desde el gráfico, y el gesto mueve el gráfico.
- AC 4. CUANDO el candado está activo ENTONCES las alertas de precio no se pueden arrastrar ni editar desde el gráfico, y el gesto mueve el gráfico.
- AC 5. CUANDO el candado está activo ENTONCES dibujos, posiciones, órdenes y alertas siguen visibles y actualizándose (precios en vivo, alertas nuevas).
- AC 6. CUANDO el candado está activo Y el usuario elige una herramienta de dibujo (o la regla) ENTONCES el candado se desactiva solo y la herramienta funciona como siempre.
- AC 7. CUANDO el candado está activo Y había un dibujo seleccionado ENTONCES se deselecciona, y Supr / Retroceso no borran nada.
- AC 8. CUANDO el usuario recarga la página o vuelve a abrir el gráfico en el mismo navegador ENTONCES el candado mantiene el último estado (guardado en el navegador, por dispositivo).
- AC 9. El botón funciona en escritorio y en móvil (táctil: tocar y arrastrar se comportan como pulsar y arrastrar).

## Fuera de alcance
- Sincronizar el estado del candado entre dispositivos (sin cambios en backend / BD).
- Bloquear elementos uno a uno.
- Ocultar dibujos o posiciones (la visibilidad sigue como hoy).
