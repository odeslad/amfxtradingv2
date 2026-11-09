# 040 — Estado de las herramientas del chart recordado por chart

> Status: **implementing**

## Contexto
La toolbar del chart tiene varios conmutadores. Algunos ya se recuerdan en el navegador (broker / símbolo / timeframe en `chart.selection`, el split view, el candado y los EMA cross trades por lado del chart), pero el botón **Positions** (none → all → buys → sells, que también muestra las órdenes pendientes) es estado React sin más: cada carga de página empieza en "none" y el trader tiene que volver a ciclarlo en cada chart. Las claves por lado además están repartidas en `ChartSlot` (`LOCK_KEY`, `EMA_TRADES_KEY`), así que cada conmutador nuevo repite el mismo cableado. El trader quiere que cada herramienta de la toolbar vuelva como la dejó, por chart.

## Capas afectadas
- frontend

## Historias de usuario
- Como trader, quiero que el botón de Positions / órdenes vuelva como lo dejé al abrir el chart de nuevo, para no ciclarlo en cada visita.
- Como trader, quiero que cada chart del split view recuerde sus propias herramientas, para que el izquierdo y el derecho mantengan su configuración.

## Criterios de aceptación
- AC 1. CUANDO el usuario cambia el modo Positions (none / all / buys / sells) en un chart ENTONCES la elección se guarda en el navegador para ese lado del chart; CUANDO se recarga la página o se abre el chart más tarde ENTONCES el botón y las posiciones / órdenes pintadas vuelven en ese modo.
- AC 2. CUANDO el split view está activo ENTONCES el chart izquierdo y el derecho recuerdan su modo Positions, su candado y sus EMA cross trades por separado; cerrar y reabrir el split restaura también las herramientas del chart derecho.
- AC 3. CUANDO el usuario cambia de broker, símbolo o timeframe ENTONCES los estados de las herramientas se conservan (pertenecen al lado del chart, no a la selección).
- AC 4. El candado y los EMA cross trades siguen funcionando exactamente como hoy y conservan sus claves actuales (`chart.locked`, `chart.locked.right`, `chart.emaTrades`, `chart.emaTrades.right`), así no se pierde nada ya guardado; el modo Positions usa el mismo patrón (`chart.positions`, `chart.positions.right`).
- AC 5. CUANDO un valor guardado falta o no es válido ENTONCES la herramienta arranca en su valor por defecto (`none`, desbloqueado, overlay apagado) sin error.
- AC 6. La herramienta de dibujo activa, la regla de pips, los paneles abiertos (alertas, indicadores, filtros, New Trade) y la pantalla completa siguen siendo transitorios: no se recuerdan.

## Fuera de alcance
- Sincronizar el estado entre dispositivos o guardarlo en el servidor.
- Recordar la herramienta de dibujo, los paneles o la pantalla completa.
- Cualquier cambio en la disposición o los iconos de la toolbar.
