# 028 — Editar alertas de precio

> Estado: **cerrada**
> Maqueta: [Edición de alertas](https://claude.ai/artifact/7LbhQNyWn6sAVVnpQWW19A) (aprobada)

## Contexto

Hoy las alertas de precio solo se crean, se activan/desactivan y se borran. Mover una alerta obliga a borrarla y crear otra. El backend `PUT /alerts/:id` ya acepta una actualización parcial (incluido el precio) y refresca la caché en memoria del evaluador, pero el frontend nunca envía un precio y el gráfico solo pinta las alertas como marcas en el eje de precios, sin interacción.

## Capas afectadas

- frontend (backend solo si la regla de reactivación necesita un cambio en el servidor — ver diseño)

## Historias de usuario

- Como trader, quiero arrastrar una alerta arriba o abajo en el gráfico, para moverla a otro nivel sin recrearla.
- Como trader, quiero escribir un precio nuevo para una alerta en el panel de alertas, para fijar un nivel exacto.
- Como trader, quiero que los botones de las alertas se vean como los de Positions, para que la app sea coherente.

## Criterios de aceptación

**Gráfico (desktop y móvil)**
- AC 1. CUANDO el usuario hace clic/toca la línea de una alerta o su etiqueta en el eje de precios ENTONCES la alerta queda seleccionada (línea naranja discontinua a lo ancho del gráfico).
- AC 2. CUANDO el usuario pulsa y arrastra una alerta seleccionada arriba o abajo ENTONCES la línea sigue al puntero y una etiqueta centrada sobre la línea, en el borde derecho junto al eje de precios, muestra `▲/▼ <precio> · <±pips>` (distancia al precio original) en desktop y solo `▲/▼ <precio>` en móvil, sin la palabra "alerta".
- AC 3. CUANDO el usuario suelta el arrastre ENTONCES se guarda el precio nuevo, la línea se queda en el precio nuevo (optimista) y el panel de alertas muestra el precio nuevo.
- AC 4. CUANDO el usuario pulsa Esc durante el arrastre ENTONCES la alerta vuelve a su precio anterior y no se guarda nada.
- AC 5. MIENTRAS se arrastra, el gráfico no se desplaza ni hace zoom.
- AC 6. CUANDO se selecciona una alerta en móvil ENTONCES una barra inferior muestra **Editar precio**, **On/Off** y **Eliminar**.

**Panel de alertas**
- AC 7. CUANDO el usuario toca el precio de una alerta en la lista ENTONCES esa fila abre un input con el precio actual y **Guardar** y **Cancelar**; Enter guarda, Esc cancela. No se muestra texto de ayuda.
- AC 8. CUANDO el precio escrito no es un número positivo ENTONCES Guardar no hace nada y el input muestra el estado de error.
- AC 9. El botón On/Off de la fila va con borde naranja y Delete con borde rojo, en mayúsculas, 34 px de alto, como Edit/Close en Positions.
- AC 10. Una alerta disparada atenúa solo su símbolo y su precio; sus botones mantienen el contraste completo.

**Reglas**
- AC 11. CUANDO se cambia el precio de una alerta disparada o en Off (arrastre o input) ENTONCES se reactiva (On, disparo borrado).
- AC 12. CUANDO se cambia el precio ENTONCES se mantiene la dirección (cruza arriba/abajo).
- AC 13. CUANDO falla el guardado ENTONCES la alerta vuelve a su precio anterior y se muestra un toast de error.

## Fuera de alcance

- Editar alertas de cruce de EMAs.
- Cambiar broker, símbolo o dirección de una alerta existente.
- Arrastrar alertas de un símbolo distinto al del gráfico.
