# 028 — Editar alertas de precio · Diseño

## Enfoque

Solo frontend. El backend ya lo soporta:

- `PUT /alerts/:id` (`backend/src/routes/alerts.ts`) es una actualización parcial que acepta `price` y `enabled`, y llama a `refreshAlerts()` para que la caché en memoria del evaluador recoja el nivel nuevo al momento.
- Una alerta disparada tiene `enabled: false` (lo pone el evaluador al saltar). Enviar `enabled: true` junto con el precio pasa por la rama existente false → true, que borra `triggeredAt`. Así el AC 11 (reactivar al editar) es `PUT { price, enabled: true }` — sin cambio en el servidor.
- `direction` no se envía, así que se mantiene (AC 12).

## Cambios en el frontend

### 1. `lib/useAlerts.ts`
Añadir `updatePrice(id, price)` → `apiSend('/alerts/:id', 'PUT', { price, enabled: true })` y refrescar la lista (igual que `toggle`/`remove`).

### 2. Panel de alertas (`features/chart/AlertsPanel.tsx` + `.module.css`)
- El precio de cada fila pasa a ser un `<button>` (`aria-label="Edit price"`). Al pulsarlo se fija `editingId`; solo una fila se edita a la vez.
- La fila en edición muestra una segunda línea: `<input inputMode="decimal">` (con foco, valor = precio actual), **Guardar** (primario) y **Cancelar** (outlined). Enter = guardar, Esc = cancelar. La cabecera muestra solo la dirección (`▲ CRUZA ARRIBA`), sin la etiqueta "editando". Sin texto de ayuda.
- Validación: `Number(value)` finito y > 0; si no, el input lleva el borde de error y Guardar no hace nada (AC 8).
- Si falla: toast de error, la fila sigue en edición con el valor escrito (la lista no ha cambiado).
- Botones: `.toggleBtn` → outlined naranja, `.deleteBtn` → outlined rojo con el texto "Delete", ambos de 34 px, mayúsculas, `--tracking-wide`, relleno al 15 % en hover — mismos valores que `.editBtn`/`.closeBtn` de `PositionCard.module.css` (AC 9).
- Fila disparada: la opacidad pasa de toda la fila a solo el bloque símbolo/broker y el precio (AC 10).
- El panel expone `onStartEdit(id)` vía prop/ref para que **Editar precio** de la barra móvil abra el panel ya editando esa alerta.

### 3. Arrastre en el gráfico (`features/chart/LightweightChart.tsx`)
Reutilizar el efecto de arrastre de SL/TP existente (dos pasos: seleccionar y luego arrastrar; listeners de ratón/táctil en fase de captura; scroll/zoom apagados al arrastrar) en lugar de un segundo efecto — dos listeners de captura en el mismo contenedor se pelearían por el `stopPropagation`.

- `DraggableLevel` pasa a ser una unión: `{ kind: 'sl' | 'tp', … }` | `{ kind: 'alert', id, alertId, price, direction }`.
- `findHit` recorre también los niveles de alerta (construidos desde la prop `alerts` del broker/símbolo actual); zona de acierto = 6 px alrededor de la Y de la alerta en todo el panel más la marca/etiqueta del eje de precios.
- Las alertas se pintan en el canvas overlay (`drawAlertMarkers`), no como price lines. Para `kind: 'alert'`:
  - `drawAlertMarkers` lee el estado de selección/arrastre: la alerta seleccionada/arrastrada dibuja una línea naranja discontinua a lo ancho y su etiqueta del eje en naranja sólido; el precio original conserva una línea tenue discontinua + etiqueta tachada mientras se arrastra.
  - `applyDragPrice` guarda el precio en vivo en `alertDragRef` y repinta el overlay; la etiqueta flotante (`▲ 1.12415 · +22.6 pips` en desktop, `▲ 1.12415` en móvil — `matchMedia('(max-width: 768px)')`) se dibuja en el canvas, alineada a la derecha junto al eje y centrada en vertical sobre la línea. Pips con `pipSize(symbol)` de `journal/utils/position.ts`.
  - `endDrag` mantiene el precio de forma optimista (`pendingPriceRef`, el mismo mecanismo que SL/TP) y llama a la nueva prop `onMoveAlert(alertId, price)`. Precio redondeado a `getPricePrecision(symbol)`.
  - Esc durante el arrastre: nuevo listener `keydown` activo solo mientras `dragStateRef.current` existe (acotado, no global) → restaura el precio original y termina sin guardar (AC 4). Se aplica también a SL/TP porque es el mismo camino de código — inocuo y coherente.
- Nueva prop `onSelectAlert(alertId | null)` para que la página sepa qué alerta está seleccionada (barra móvil).

### 4. `ChartPage.tsx`
- `chartAlerts` lleva también `direction`.
- `onMoveAlert` → `alerts.updatePrice`; si falla, toast + `refreshAlerts()` (el precio optimista se descarta al volver la lista sin cambios, AC 13).
- Solo móvil: con una alerta seleccionada, se muestra `AlertActionBar` (componente nuevo pequeño + CSS module) abajo del gráfico: **Editar precio** (primario; abre el panel de alertas editando esa alerta), **On/Off** (outlined naranja), **Eliminar** (outlined rojo), áreas táctiles de 44 px (AC 6).

## Flujo de datos

Arrastre en el gráfico / input del panel → `useAlerts.updatePrice` → `PUT /alerts/:id { price, enabled: true }` → BD + `refreshAlerts()` (caché del evaluador) → respuesta → refresco de la lista → se repintan las marcas del gráfico y el panel.

## Archivos

- `frontend/src/lib/useAlerts.ts`
- `frontend/src/features/chart/AlertsPanel.tsx`, `AlertsPanel.module.css`
- `frontend/src/features/chart/LightweightChart.tsx`
- `frontend/src/features/chart/ChartPage.tsx`
- `frontend/src/features/chart/AlertActionBar.tsx`, `AlertActionBar.module.css` (nuevos)

Sin cambios en BD, backend, EA ni contrato. Sin dependencias nuevas.

## Alternativas consideradas

- **Hook de arrastre separado para alertas**: separa mejor los ficheros, pero duplica la lógica de acierto/arrastre/táctil y los dos listeners de captura chocan. Descartada.
- **Pintar las alertas como price lines de lightweight-charts** (como SL/TP) para moverlas con `applyOptions({ price })`: arrastre más simple, pero cambia cómo se ven hoy todas las alertas (líneas a todo el ancho) — no está en la maqueta. Descartada.

## Riesgos

- `LightweightChart.tsx` ya es grande; la unión de tipos mantiene pequeñas las ramas de alerta, pero crece más. Candidato a un refactor posterior (auditoría de frontend).
- Las zonas de acierto de una alerta y un SL/TP casi al mismo precio se solapan: gana la más cercana (regla actual).
- Táctil: el primer toque selecciona, así que un toque accidental al desplazar solo selecciona, nunca mueve.
