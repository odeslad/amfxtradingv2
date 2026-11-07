# 039 — Overlay de trades por cruce de EMAs · Diseño

## Enfoque

Tres piezas pequeñas sobre lo que ya existe:

1. **Parámetros** en `SettingsDisplay` (cinco columnas nuevas) que viajan por `/settings` como `fibLevels` (spec 037): un grupo global en Ajustes > Display.
2. **Setups** desde el backend: `detectEmaCrossSetups` ya da, por cruce, la vela de activación (`activationTime`, `ECC` = su cierre), la dirección, el EVL anterior de la EMA rápida y el siguiente cruce contrario (`closeTime`). `GET /setup-levels` gana un `limit` y devuelve los últimos N setups en vez de solo el último; el frontend añade el offset de entrada y el tope de duración, que son reglas de presentación.
3. **Pintado** en el canvas de overlay que ya tiene el chart (`overlayRef` en `LightweightChart`, el que pinta las líneas de rollover y los marcadores de alertas y se repinta en cada cambio de rango visible). Los trades no son dibujos: `DrawingManager` no se toca, nada va a `/drawings`.

## Alternativas

- **Calcular los cruces en el frontend** con las 2000 velas cargadas y el código de EMAs del chart: sin cambio de backend, pero duplica `detectEmaCrossSetups` (reglas de EVL y cierre de setup) y el panel New Trade mostraría niveles de una implementación y el overlay de otra. Descartado: una sola implementación, en el servidor.
- **Pintar los niveles como price lines de `lightweight-charts`**: etiquetas de eje gratis, pero las price lines cruzan todo el ancho y no pueden empezar ni terminar en una vela (AC 3). Descartado.
- **Hacer de los trades un tipo de dibujo**: se guardarían, seleccionarían y contarían, lo contrario del AC 6. Descartado.

## Cambios por capa

### db

**`backend/prisma/schema.prisma`** · `SettingsDisplay` gana `emaTradesFast Int @default(24)`, `emaTradesSlow Int @default(48)`, `emaTradesEntryPips Float @default(5)`, `emaTradesHours Int @default(24)`, `emaTradesCount Int @default(3)`. Migración escrita a mano `20261108000000_ema_trades_settings`:

```sql
ALTER TABLE "settings_display"
  ADD COLUMN "emaTradesFast" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesSlow" INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN "emaTradesEntryPips" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "emaTradesHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesCount" INTEGER NOT NULL DEFAULT 3;
```

### backend

**`src/routes/settings.ts`** · `DisplayInput` / `DisplayRow` / `toResponse` / upsert ganan un objeto `emaTrades` `{ fast, slow, entryPips, hours, count }` mapeado a las cinco columnas. Validación: `fast`, `slow` enteros positivos y distintos; `entryPips` finito ≥ 0; `hours` entero 1–720; `count` entero 1–10. Ausente → se conserva el valor guardado, como el resto de campos de display.

**`src/routes/setup-levels.ts`** · query opcional `limit` (entero 1–10, por defecto 1). La respuesta mantiene `setup` (el último, sin cambios para el panel New Trade) y añade `setups`: los últimos `limit` setups, del más antiguo al más reciente, cada uno `{ direction, activationTime, closeTime, levels: { ECC, EVL }, pipSize }`. `MAX_CANDLES` sigue en 1000 (suficiente para 10 setups en H1; en D1 pueden salir menos, lo que permite el AC 8).

### frontend

**`features/settings/DisplayTab.tsx`** · `DisplaySettingsForm` gana `emaTrades: { fast, slow, entryPips, hours, count }`; nuevo grupo "EMA cross trades" tras "Fibonacci levels" (maqueta): filas a dos columnas con un input numérico cada una (EMA rápida, EMA lenta, offset de entrada en pips, duración máxima en horas, trades mostrados), sin spinners como pide la regla del proyecto. `SettingsPage.tsx` añade los valores por defecto y envía el objeto dentro de `display`.

**`lib/useEmaTradesSettings.ts`** (nuevo, misma forma que `useDisplaySettings`) · lee `display.emaTrades` de `/settings` una vez; `ChartPage` lo pasa a los dos slots, así un Save en Ajustes se recoge en la siguiente carga de la página Chart (la página ya vuelve a pedir `/settings` al montar; el "se redibujan" del AC 7 significa tras guardar y volver al chart, como los niveles de Fibonacci).

**`features/chart/ChartSlot.tsx`**
- `const [emaTradesOn, setEmaTradesOn] = useLocalStorage(EMA_TRADES_KEY[side], false)` con `'chart.emaTrades'` / `'chart.emaTrades.right'` (AC 6).
- `useEmaCrossTrades(enabled, broker, symbol, timeframe, settings, lastClosedTime)` (hook nuevo en `features/chart/useEmaCrossTrades.ts`): si está activo, `GET /setup-levels?broker&symbol&tf&emaFast&emaSlow&limit=count`; vuelve a pedir cuando cambia cualquier argumento, siendo `lastClosedTime` el tiempo de la última vela del estado (un mensaje WS `candle` lo cambia, AC 5). Mapea cada setup a un `EmaCrossTrade`: `{ direction, startTime, endTime, entry, sl: number | null, riskPips: number | null, label }` donde `entry = ECC ± entryPips × pipSize`, `endTime = min(closeTime ?? +∞, startTime + hours × 3600)`.
- Pasa `emaCrossTrades` a `LightweightChart`; `ChartToolbar` recibe `emaTradesActive` + `onToggleEmaTrades`.

**`features/chart/ChartToolbar.tsx`** · nuevo botón conmutador tras las herramientas de dibujo (escritorio) y en la fila Draw (móvil), `aria-pressed`, estilo activo como el candado; `shared/ui/icons.tsx` gana `IconEmaTrades` (dos curvas que se cruzan y una vertical discontinua, como en la maqueta).

**`features/chart/LightweightChart.tsx`**
- Nueva prop `emaCrossTrades?: EmaCrossTrade[]` guardada en un ref; `drawRollovers` (el pintor del overlay) llama a `drawEmaCrossTrades(ctx, chart, series)` tras los marcadores de alertas, y el cambio de la prop dispara un repintado.
- `drawEmaCrossTrades`: por cada trade, x de `startTime` con `timeScale().timeToCoordinate`; x de `endTime` igual cuando cae dentro de los datos, y si no `logicalToCoordinate(lastIndex + (endTime − lastTime) / tfSeconds)` para que un trade vivo se proyecte más allá de la última vela (AC 3); y con `series.priceToCoordinate`. Pinta: la línea vertical discontinua (`rgba(200,168,64,0.35)`, alto completo del panel), la línea de entrada (sólida `--gold`, 1.5 px), la línea de SL (discontinua `--red`) y el relleno entre ambas (`rgba(224,92,92,0.07)`) cuando `sl` no es null (AC 4), la etiqueta superior `#n BUY · 02 Nov 13:00` en DM Mono 9 px dorado junto a la vertical, y las etiquetas de extremo (`BUY 1.11974` sobre dorado, `SL 9.8 p` sobre rojo, texto negro / blanco) justo tras el final de la línea, recortadas al panel como las líneas de rollover. Colores por hex literal de los tokens del sistema de diseño, como el resto del código de canvas.
- Los disparadores de repintado ya existen: cambio de rango visible, resize, cambio de `candles`, `updateLive` → `drawRolloversRef`.

## Flujo de datos

```
Ajustes > Display ──PUT /settings { display.emaTrades }──▶ settings_display ──GET /settings──▶ ChartPage ──▶ ChartSlot
ChartSlot (overlay activo) ──GET /setup-levels?…&emaFast&emaSlow&limit──▶ detectEmaCrossSetups ──setups──▶ useEmaCrossTrades ──EmaCrossTrade[]──▶ canvas de overlay de LightweightChart
WS candle (cerrada) ──▶ ChartSlot.candles ──▶ cambia lastClosedTime ──▶ nueva petición
```

## Riesgos

- **Presupuesto de velas**: `/setup-levels` lee 1000 velas; en D1 con EMA lenta 48 son años y sobra, en M5 son 3,5 días y puede haber menos de N cruces. Aceptable (AC 8); `limit` está topado a 10.
- **Proyección más allá de los datos**: `logicalToCoordinate` pasado el último bar depende del margen derecho del chart; la etiqueta puede caer fuera del panel y se recorta. Aceptable; las líneas siguen visibles al desplazar.
- **Solape de etiquetas**: trades que terminan en la misma x apilan sus etiquetas; la etiqueta de extremo va 4 px a la derecha del final y mide 16 px de alto, así que dos trades que terminan juntos solo se solapan si sus niveles distan menos de 16 px. Aceptado para un overlay de diagnóstico.
- **Refresco de Ajustes**: el chart lee `/settings` al montar; cambiar el grupo con una pestaña de chart abierta exige recargar la página Chart. Mismo comportamiento que los niveles de Fibonacci.

## Maqueta

Aprobada por el usuario el 2026-11-07 (iterada sobre una captura real de EURUSD H1): https://claude.ai/artifact/QixNCKFN4XJa9NYd33aULG

Artboards:
- Desktop · chart real EURUSD H1 · últimos 3 trades por cruce de EMAs — línea vertical discontinua en cada cruce, entrada dorada sólida, SL rojo discontinuo, relleno tenue entre ambas, etiqueta `#n SELL · fecha` arriba, etiquetas de extremo `SELL 1.11810` / `SL 7.6 p`; el trade 1 termina en el siguiente cruce contrario, los trades 2 y 3 a las 24 h; franja de toolbar con el botón nuevo activo; leyenda. Acordado en el canvas: sin punto marcador, etiqueta de SL solo con pips, sin texto "closed by", entrada dorada y SL rojo independientemente de la dirección, EMAs 24 / 48.
- Desktop · Ajustes > Display · grupo EMA cross trades — EMA rápida 24, EMA lenta 48, offset de entrada 5 pips, proyección 24 h, trades mostrados 3.
