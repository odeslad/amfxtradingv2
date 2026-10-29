# 032 — Spread en el gráfico · Diseño

## Enfoque

Seguir de punta a punta el ajuste `rectLabels` de la spec 025: columna booleana en `settings_display`, leída y escrita por `/settings`, un interruptor en Settings › Display y ChartPage leyéndolo una vez al cargar. El camino de los ticks no cambia: el EA ya envía `ask` y `broadcastTicks` reenvía el lote tal cual (`backend/src/ws/ws.ts:90`). Solo el gráfico empieza a usar el `ask`.

## Flujo de datos

```
tick del EA {bid, ask, m5_open…}  ──pipe──▶  backend broadcastTicks (sin cambios)  ──WS ticks──▶  ChartPage
                                                                                                  │ último tick del símbolo
settings_display.showSpread ──GET /settings──▶ ChartPage ──prop showSpread──▶ LightweightChart
                                                              updateLive(candle, ask)  ──▶  líneas ASK / BID
```

Sin cambios en el contrato EA ↔ backend.

## Por capa

### db
- Migración `20261029000000_show_spread`: `ALTER TABLE "settings_display" ADD COLUMN "showSpread" BOOLEAN NOT NULL DEFAULT false;`
- `schema.prisma`: `showSpread Boolean @default(false)` en `SettingsDisplay`.

### backend (`src/routes/settings.ts`)
- `DisplayInput.showSpread?: boolean`, validado con `optionalBoolean` como `rectLabels`.
- `DisplayRow.showSpread`; el GET devuelve `display.showSpread ?? false`; el PUT lo escribe solo si viene.
- Test de ruta: GET por defecto `false`, PUT `true` se conserva, valor no booleano → 400.

### frontend
- **Settings › Display** (`DisplayTab.tsx`, `SettingsPage.tsx`): nueva fila con interruptor "Spread (líneas ASK y BID)" bajo "Rectangle labels", mismo marcado `toggle`; `DEFAULT_DISPLAY.showSpread = false`.
- **ChartPage**: leer `display.showSpread` en el efecto de `/settings` existente; pasar `showSpread` a `LightweightChart`; en el manejador de ticks pasar `last.ask` a `updateLive`.
- **LightweightChart**:
  - `ChartHandle.updateLive(candle, ask?)`.
  - `showSpread` desactivado → la serie de velas mantiene `priceLineVisible` / `lastValueVisible` (como hoy).
  - `showSpread` activado → la serie de velas pasa a `priceLineVisible: false, lastValueVisible: false`, más dos `IPriceLine` creadas una vez y movidas con `applyOptions({ price })` en cada tick:
    - **BID** en el cierre en vivo (bid), `rgba(180,180,180,0.6)`, etiqueta `BID`.
    - **ASK** en `ask`, `--red` `#e05c5c` discontinua, etiqueta `ASK`; no se crea hasta que llega un tick con `ask` (CA 5).
  - Al cambiar la prop se quitan / recrean las dos líneas y se restauran las opciones de la serie.
- Sin dependencias nuevas.

## Alternativas

- **Ajuste solo en `localStorage`** (solo frontend): más rápido, pero la opción no seguiría al usuario entre escritorio y móvil, a diferencia del resto de ajustes de visualización. Descartada.
- **Segunda serie de línea para el ask**: pinta un histórico del ask, que nadie ha pedido, y entra en el autoescalado. Descartada en favor de las líneas de precio.

## Riesgos

- El pipe envía ticks cada 100 ms; mover dos líneas de precio por tick cuesta lo mismo que el `series.update` de hoy.
- Símbolos en los que un broker envía `ask = 0` o sin `ask`: se tratan como "sin ask" (CA 5).

## Maqueta

Aprobada el 2026-10-29: https://claude.ai/artifact/EKsLdxeevvjPyZB49ZduUF

Vistas: escritorio gráfico con spread desactivado (hoy) · escritorio gráfico con spread activado · escritorio Settings › Display · móvil gráfico con spread activado · móvil Settings › Display.
