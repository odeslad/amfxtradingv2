# 025 — Arreglos del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Est | Real |
|---|---|---|---|---|---|
| 1 [backend] | build + vitest + backend local | `npm run build` · `npm test` (103 tests, 4 nuevos en `candle-close.test.ts`) · `npm run lint` · backend local en el 3001, bridges apagados, BD de producción por el túnel → `/health` 200 | ✅ pasa | 1 | 0,75 |
| 2 [frontend] | build + lint + app local sobre la API de producción | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` (ticks reales) | ✅ pasa | 1,5 | 1,5 |
| 3 [db] | `prisma generate` + build + `migrate diff` contra producción | `npx prisma generate` · `npm run build` · `prisma migrate diff --from-url <producción vía túnel> --to-schema-datamodel` | ✅ pasa | 0,25 | 0,25 |
| 4 [backend] | build + tests + lint | `npm run build` · `npm test` · `npm run lint` | ✅ pasa (de punta a punta en la tarea 7) | 0,25 | 0,25 |
| 5 [frontend] | build + lint + app local | `npm run build` · `npm run lint` · Vite en el 5174 con proxy a `api-v2` | ✅ pasa (toggle 🕐 tarea 7) | 2,5 | 2,5 |
| 6 [frontend] | build + lint + app local a 390 px | `npm run build` · `npm run lint` · modo dispositivo en la app local | ✅ pasa (iPhone 🕐 tarea 7) | 1,5 | 0,75 |

## Evidencia

### Tarea 1

`tsc` y `eslint` limpios; toda la suite pasa. Los tests nuevos cubren el rastreador: el primer tick solo
siembra, los ticks con el mismo time no reportan nada, un `m5_time` avanzado cierra la vela M5 con la
apertura / máximo / mínimo del tick anterior y su bid como cierre, un cambio de hora cierra M5 / M15 / H1 a
la vez sin tocar otro símbolo ni broker, y un tick sin time de vela se salta. La ruta del rollover en sí
(upsert + emisión `candle`) necesita un pipe vivo, así que se comprueba en producción en la tarea 5.

### Tarea 2

Build y lint limpios. Comprobado por el usuario en la app local contra la API de producción el
24-10-2026: las EMAs llegan a la vela viva y se mueven con los ticks, las líneas de rollover se detienen
en el panel de velas al desplazar a la derecha, los marcadores de alerta se actualizan al momento al
crear / activar / borrar (la última incluida). El mensaje `candle` no se puede ver hasta desplegar el
backend (tarea 5). Arreglo colateral encontrado al probar: el proxy de desarrollo reescribe la cookie de
sesión a solo-host (`cookieDomainRewrite`), porque Chrome descartaba la cookie `Domain=.amfxtrading.com`
de producción al llegar por el proxy y toda petición rebotaba al login; el logout borra también el ámbito
solo-host en el backend.

### Tareas 3–4

El CA 17 se añadió durante la implementación a petición del usuario. El diff contra producción imprime
exactamente:

```
ALTER TABLE "settings_display" ADD COLUMN "rectLabels" BOOLEAN NOT NULL DEFAULT true;
```

`/settings` acepta un `display.rectLabels` opcional y lo devuelve (por defecto `true`); la suite y el
lint del backend siguen en verde. El toggle no llega al backend desplegado antes del push, así que se
comprueba en producción en la tarea 7.

### Tarea 5

Validado por el usuario en la app local el 24-10-2026: rectángulo con ocho anclas y la cruz central, cada
lado y esquina redimensionando su borde, cursor de mano sobre los dibujos y cursores de redimensión / mover
en un rectángulo seleccionado, precios superior / inferior y etiqueta de pips a 9 px en blanco con contorno
negro, anillo naranja en marcadores y símbolos seleccionados, texto seleccionado en naranja sin marco.
Iterado con el usuario (números más pequeños, pips abajo a la izquierda, blanco con contorno). El cursor
necesitó una regla CSS en el contenedor del gráfico (`--draw-cursor` con `!important`): el canvas de dibujos
ignora los eventos de puntero y lightweight-charts pone su propio cursor en sus elementos internos. El
toggle Rectangle labels no surte efecto contra el backend desplegado todavía; se valida en producción en la
tarea 7.

### Tarea 6

Comprobado por el usuario en la app local el 24-10-2026: una fila de 44 px en ancho de móvil (timeframe,
posiciones, alertas, filtros, indicadores, pantalla completa, Draw), Draw abriendo y cerrando la segunda
fila de ocho herramientas, la fila sigue abierta tras dibujar, fila de escritorio sin cambios, botones Add
del panel de alertas con el estilo primario naranja. Las herramientas se reparten la segunda fila (`flex:
1`) porque ocho botones fijos de 44 px no caben en 390 px. El iPhone en sí se comprueba en producción
(tarea 7).
