# 036 — Vista dividida del gráfico

> Status: **closed**

## Contexto
La sección Chart muestra un gráfico del broker y símbolo seleccionados, con una fila de timeframes (M5 · M15 · H1 · H4 · D1) y una barra de herramientas (indicadores, alertas, bloqueo, herramientas de dibujo, pantalla completa…). Para comparar dos temporalidades del mismo par el operador tiene que cambiar de una a otra, perdiendo la vista cada vez. No hay forma de ver dos temporalidades a la vez.

## Capas afectadas
- frontend

## Historias de usuario
- Como operador, quiero un botón de split en el gráfico que abra un segundo gráfico junto al primero, para vigilar dos temporalidades del mismo par al mismo tiempo.
- Como operador, quiero que cada gráfico tenga su propia fila de timeframes y su barra de herramientas, para trabajar en cualquiera de los dos (dibujar, poner alertas, bloquear, pantalla completa) sin que el otro cambie.
- Como operador, quiero que el split y las dos temporalidades se recuerden en mi navegador, para que el gráfico se abra como lo dejé.

## Criterios de aceptación
- AC 1. CUANDO el usuario pulsa el botón de split en la barra del gráfico en escritorio ENTONCES el área del gráfico se divide en dos gráficos lado a lado, por defecto con la mitad del ancho cada uno, ambos con el broker y símbolo actuales; el gráfico izquierdo conserva su timeframe, vista, dibujos e indicadores, y el derecho se abre en la temporalidad inmediatamente superior (H1 → H4; D1 → H1).
- AC 2. CUANDO el split está activo ENTONCES cada gráfico tiene su propia fila de timeframes y su barra completa, y cada acción de la barra (timeframe, posiciones, alertas, bloqueo, herramientas de dibujo, regla, texto, pantalla completa) actúa solo sobre el gráfico al que pertenece. Los indicadores (EMAs) y los filtros siguen siendo compartidos: ambos gráficos muestran las mismas EMAs y el botón de indicadores de cualquiera edita ese conjunto común.
- AC 3. CUANDO el usuario cambia el broker o el símbolo ENTONCES los dos gráficos cambian juntos; cada uno conserva su timeframe.
- AC 4. CUANDO el split está activo ENTONCES ambos gráficos reciben ticks en vivo, vela activa, velas cerradas, posiciones, órdenes, alertas y dibujos exactamente como hoy el gráfico único, cada uno para su timeframe.
- AC 5. CUANDO el usuario vuelve a pulsar el botón de split, en cualquiera de los dos gráficos, ENTONCES el split se cierra y permanece el gráfico cuyo botón se pulsó: desde el izquierdo, el gráfico izquierdo conserva su timeframe; desde el derecho, el gráfico único toma el timeframe del derecho. CUANDO se vuelve a abrir el split ENTONCES los dos gráficos vuelven con los timeframes y el orden que tenían al cerrarlo.
- AC 6. CUANDO el usuario pone un gráfico en pantalla completa ENTONCES solo ese gráfico ocupa la pantalla; al salir se vuelve al split.
- AC 7. CUANDO el usuario abre un panel desde un gráfico (New Trade desde el gráfico, panel de alerta, edición de posición) ENTONCES el panel se preselecciona con el timeframe de ese gráfico allí donde hoy usa el timeframe del gráfico.
- AC 8. CUANDO el split está activo ENTONCES un divisor vertical entre los dos gráficos se puede arrastrar con el ratón para cambiar el ancho de las columnas; cada gráfico conserva al menos el 25 % del ancho y nunca menos de lo que necesita su barra (ningún botón queda cortado), y ambos se redibujan a su nuevo tamaño mientras se arrastra.
- AC 9. CUANDO el usuario recarga la página o vuelve a Chart en el mismo navegador ENTONCES se restauran el estado del split, el timeframe de cada gráfico y la posición del divisor (guardados en el navegador, por dispositivo).
- AC 10. CUANDO el viewport es móvil (≤ 768 px) ENTONCES el botón de split no se muestra y se ve un solo gráfico aunque el split estuviera activo en una ventana más ancha; al volver a ensanchar la ventana se restaura el split.

## Fuera de alcance
- Brokers o símbolos distintos por gráfico.
- Más de dos gráficos, o un split vertical (apilado) en escritorio.
- Indicadores por gráfico (hoy las EMAs son un ajuste por usuario; una spec posterior podría separarlos).
- Sincronizar el estado del split entre dispositivos (sin cambios de backend / BD).
- Sincronizar el crosshair o el rango de tiempo visible entre los dos gráficos.
