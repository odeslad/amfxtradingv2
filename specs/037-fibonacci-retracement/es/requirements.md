# 037 — Herramienta de retroceso de Fibonacci

> Status: **implementing**

## Contexto
El chart tiene un conjunto de herramientas de dibujo (línea de tendencia, rectángulo, regla de pips, marcadores, símbolos, texto) implementadas sobre un canvas en `DrawingTools.ts` y persistidas por usuario, broker, símbolo y timeframe como una lista JSON a través de `GET/PUT /drawings`. El trader no tiene forma de dibujar los niveles de retroceso de Fibonacci sobre un impulso: hoy traza varias líneas horizontales a mano o lee los niveles en otra plataforma.

## Capas afectadas
- frontend · backend · db

## Historias de usuario
- Como trader, quiero una herramienta de Fibonacci en la barra de dibujo que trace los niveles de retroceso entre dos puntos que yo marco, para ver en el chart los niveles habituales de retroceso de un impulso.
- Como trader, quiero mover y redimensionar el Fibonacci como cualquier otro dibujo y que se guarde con el resto, para que siga ahí cuando vuelva a ese chart.
- Como trader, quiero el porcentaje y el precio de cada nivel junto a la línea, para colocar entradas, stops y objetivos sobre ellos sin medir.
- Como trader, quiero elegir en Ajustes > Display qué niveles de Fibonacci se dibujan, para que la herramienta muestre solo los niveles que opero.

## Criterios de aceptación
- AC 1. CUANDO el usuario elige la herramienta Fibonacci y hace dos clics en el chart ENTONCES se dibuja un retroceso de Fibonacci entre ellos: el nivel 0 en el precio del segundo punto y el nivel 100 en el del primero, con los niveles activados en Ajustes > Display (por defecto 0 · 23,6 · 38,2 · 50 · 61,8 · 78,6 · 100) como líneas horizontales. La previsualización sigue al cursor tras el primer clic, como la línea de tendencia y el rectángulo; Escape cancela.
- AC 2. CUANDO hay un Fibonacci dibujado ENTONCES cada línea de nivel va desde el ancla más a la izquierda hasta el ancla más a la derecha, y un segmento discontinuo une las dos anclas. Cada nivel muestra una etiqueta con su porcentaje y su precio, en el extremo izquierdo de la línea, con el estilo monoespaciado de las etiquetas del chart.
- AC 3. CUANDO el usuario hace clic en un Fibonacci ENTONCES queda seleccionado (asas en las dos anclas); CUANDO está seleccionado ENTONCES arrastrar un ancla mueve esa ancla y los niveles la siguen, y arrastrar el segmento entre anclas mueve todo el dibujo. El bloqueo, Supr / Retroceso, los botones de borrar y borrar todo, Ctrl + arrastrar para duplicar y el doble clic para rotar el color (por defecto → rojo → verde) funcionan como en la línea de tendencia.
- AC 4. CUANDO el usuario cambia de timeframe, recarga la página o abre el chart en otro dispositivo ENTONCES el Fibonacci vuelve sobre los mismos precios y tiempos, persistido por el endpoint `/drawings` existente junto a los demás dibujos. Un build de frontend anterior ignora el nuevo tipo sin romperse.
- AC 5. CUANDO el chart está en vista dividida ENTONCES cada chart tiene su propia herramienta de Fibonacci y sus propios dibujos, como con cualquier otra herramienta.
- AC 6. CUANDO el viewport es móvil ENTONCES la herramienta Fibonacci aparece en la fila Draw con las demás y los dos toques, el arrastre y el doble toque funcionan como en la línea de tendencia.
- AC 7. CUANDO el trader cambia el color, estilo o grosor de la línea de tendencia en Ajustes > Display ENTONCES las líneas de nivel del Fibonacci siguen la misma apariencia; los niveles 50 % y 61,8 % se dibujan con estilo continuo y el color de texto brillante para destacar.
- AC 8. CUANDO el trader abre Ajustes > Display ENTONCES un grupo Niveles de Fibonacci lista el catálogo 0 · 23,6 · 38,2 · 50 · 61,8 · 78,6 · 100 · 127,2 · 161,8 · 200 · 261,8 con un interruptor cada uno; 0 y 100 están siempre activos (son las anclas). CUANDO el trader cambia un nivel y guarda ENTONCES todos los Fibonacci de todos los charts se redibujan con el nuevo conjunto, sin tocar los dibujos guardados. Los niveles por encima de 100 se extienden más allá de la primera ancla en la dirección del impulso.

## Fuera de alcance
- Abanicos, arcos, zonas temporales y ratios personalizados fuera del catálogo.
- Colores por nivel y conjuntos de niveles por dibujo: el conjunto es global, como la apariencia de la línea de tendencia.
- Alertas sobre niveles de Fibonacci.
