# 038 — Regla de pips redimensionable

> Status: **closed**

## Contexto
La regla de pips del chart (`DrawingTools.ts`) es una medición en dos clics: el primero fija el inicio, el segundo el final, y la caja con su etiqueta `pips · barras · %` queda en pantalla hasta que cualquier clic posterior la borra. No se puede seleccionar, mover ni redimensionar: un segundo clic mal dado obliga a medir de nuevo desde cero. El usuario quiere que se comporte como la herramienta Fibonacci de la spec 037 (handles, arrastre, pulsar-arrastrar-soltar en táctil) pero que siga siendo efímera: una medición, no un dibujo que se guarda. Continuación de [037-fibonacci-retracement](../../../archive/2026-11/037-fibonacci-retracement/es/requirements.md).

## Capas afectadas
- frontend

## Historias de usuario
- Como trader, quiero ajustar los extremos de una regla que acabo de medir, para corregir un clic sin empezar de nuevo.
- Como trader, quiero mover la regla entera a otro impulso, para comparar movimientos del mismo tamaño.
- Como trader, quiero que la regla siga siendo una medición temporal, para que nunca ensucie mis dibujos guardados.

## Criterios de aceptación
- AC 1. CUANDO el usuario elige la regla y hace dos clics ENTONCES la regla se mide como hoy (caja, diagonal discontinua, etiqueta `pips · barras · %`, verde si el movimiento es alcista y roja si es bajista) y queda en pantalla **seleccionada**, con un handle en cada extremo.
- AC 2. CUANDO la regla está seleccionada y el usuario arrastra un handle ENTONCES ese extremo se mueve y la caja y la etiqueta se recalculan en vivo; CUANDO el usuario arrastra la caja o la diagonal ENTONCES toda la regla se mueve conservando su tamaño.
- AC 3. CUANDO el usuario hace clic en el chart fuera de la regla ENTONCES la regla se deselecciona pero sigue en pantalla; CUANDO la regla no está seleccionada y el usuario hace clic sobre ella ENTONCES vuelve a seleccionarse. Supr / Retroceso con la regla seleccionada, Escape, Borrar todo, elegir cualquier herramienta de dibujo, un cambio de timeframe, de símbolo o de broker o una recarga la eliminan. Medir de nuevo sustituye la regla anterior.
- AC 4. CUANDO el chart está bloqueado ENTONCES la regla ignora el puntero como los demás dibujos; el bloqueo no la elimina.
- AC 5. CUANDO el usuario pulsa, arrastra y suelta en táctil ENTONCES la regla se mide donde se levanta el dedo (un toque simple mantiene el flujo de dos toques, como en las demás herramientas de dos anclas); los arrastres de handle y de cuerpo también funcionan por táctil.
- AC 6. La regla nunca se envía a `/drawings`; el contador de dibujos que muestra los botones de borrar / borrar todo la ignora. El botón Delete actúa sobre la regla seleccionada cuando ella es la selección.

## Fuera de alcance
- Persistir la regla o mostrar más de una a la vez.
- Cambiar el contenido o los colores de la etiqueta.
- Ctrl + arrastrar para duplicar y doble clic para rotar el color en la regla.
