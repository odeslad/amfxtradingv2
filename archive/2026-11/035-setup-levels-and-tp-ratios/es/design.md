# 035 — Setup levels en modo mirror, visibilidad de niveles y atajos de TP por ratio · Diseño

## Enfoque

Tres cambios independientes, cada uno siguiendo un patrón que el código ya tiene:

1. **Niveles en modo mirror**: quitar la condición `mode === 'manual'` en `NewTradePanel` y derivar un `levelsBroker` que es el broker manual o, en mirror, el broker del preset a usar. Todo lo que cuelga de ahí (carga, suscripción al bid, panel) usa `levelsBroker` en lugar de `broker`.
2. **Visibilidad de niveles**: una columna más en `settings_display`, como `showSpread` (spec 032): `setupLevels TEXT[]` con las claves de nivel a mostrar. Settings › Display gana un interruptor por nivel; New Trade filtra `LEVEL_KEYS` con él.
3. **Ratios de TP**: un helper puro `tpForRatio(entry, sl, side, ratio, precision)` en `features/journal/utils/position.ts`, usado por New Trade (una entrada) y Edit group (una entrada por posición).

Sin cambios en el EA. Sin cambio del contrato EA ↔ backend. Sin dependencias nuevas.

## Flujo de datos

```
settings_display.setupLevels ──GET /settings──▶ NewTradePanel (niveles visibles)    SettingsPage › DisplayTab ──PUT /settings──▶ settings_display
Ticks del EA {bid, ask} ──pipe──▶ broadcastTicks ──WS ticks──▶ NewTradePanel (bid + ask de levelsBroker/symbol)
GET /setup-levels?broker=<levelsBroker>&symbol&tf ──▶ NewTradePanel.setup (ruta sin cambios)
```

## Por capa

### db
- Migración `20261101000000_setup_levels`: `ALTER TABLE "settings_display" ADD COLUMN "setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']::TEXT[];`
- `schema.prisma`: `setupLevels String[] @default(["ECC", "EMA", "EVL", "MHL"])` en `SettingsDisplay`.

### backend (`src/routes/settings.ts`)
- `SETUP_LEVEL_KEYS = ['ECC','EMA','EVL','MHL']`. `DisplayInput.setupLevels?: string[]`: array opcional cuyos elementos deben ser cada uno una de las claves (400 si no); duplicados eliminados, orden normalizado al de `SETUP_LEVEL_KEYS`. Un array vacío es válido (AC 6).
- `DisplayRow.setupLevels`; GET devuelve `display.setupLevels ?? SETUP_LEVEL_KEYS`; PUT lo escribe solo cuando viene; `create` usa las cuatro claves por defecto.
- Test de ruta: GET por defecto tiene las cuatro claves, PUT `['ECC','EVL']` hace ida y vuelta, `['XXX']` → 400, `[]` aceptado.

### frontend

**`features/journal/utils/position.ts`**
- `export const SETUP_LEVEL_KEYS = ['ECC','EMA','EVL','MHL'] as const; export type SetupLevelKey = …`.
- `export const TP_RATIOS = [2, 3] as const`.
- `export function tpForRatio(entry: number, sl: number, buySide: boolean, ratio: number, precision: number): number | null` — `null` cuando `entry`/`sl` no son finitos o son iguales; si no, `entry ± |entry − sl| × ratio` redondeado a `precision` decimales.
- `export function pricePrecision(symbol: string): number` — `3` para pares JPY, `5` en el resto (la misma regla que aplica hoy `LightweightChart.getPricePrecision`; el gráfico conserva su copia o importa esta).
- Tests unitarios (vitest, `position.test.ts`): buy/sell, ambos ratios, precisión JPY, casos null.

**`NewTradePanel.tsx`**
- `levelsBroker = mode === 'manual' ? broker : (activeMirrorBrokers.some(m => m.broker === initialBroker) ? initialBroker : activeMirrorBrokers[0]?.broker ?? '')`.
- `levelsKey`, el efecto de `/setup-levels`, la suscripción a ticks y las condiciones del panel/timeframe usan `levelsBroker && symbol` (sin comprobar `mode`). La cabecera de niveles muestra `· <levelsBroker>` solo en mirror (maqueta).
- La suscripción a ticks guarda también `ask` (`findLast` del símbolo; `t.ask`), para que la entrada a mercado de los buy sea el ask.
- Niveles visibles: `visibleLevels = SETUP_LEVEL_KEYS.filter(k => display.setupLevels.includes(k))`, desde `/settings`, que el panel ya carga al abrir (`settings.display.setupLevels`). Con `visibleLevels.length === 0` se ocultan el selector de timeframe y el panel.
- Campo TP con dos modos, estado `tpRatio: 2 | 3 | null`. Botones de ratio: dos botones pequeños outlined `2:1` / `3:1` en la fila de la etiqueta TP, alineados a la derecha (20 px de alto en escritorio, 24 px en móvil), el activo con contorno naranja (maqueta). Clic → `setTpRatio(r); setTp('')`.
  - `tpRatio === null` → el input de precio de hoy.
  - `tpRatio` fijado → el input se sustituye por una caja chip: `<ratio> · <precio>` (o `<ratio>` solo cuando no se puede calcular) y una ✕ que devuelve `tpRatio` a `null`. El precio se deriva en cada render: `tpForRatio(entry, parseFloat(sl), buySide, tpRatio, precision)` con `entry = isPending ? parseFloat(price) : (buySide ? ask : bid)`, así que sigue al SL, al Price, al lado y a los ticks (AC 10). Sin texto de ayuda.
  - Envío: `tp = tpRatio ? calculado ?? null : parseFloat(tp) || 0`; con `tpRatio` fijado y sin precio calculable el botón de envío queda deshabilitado (AC 9).
- CSS: `.tpLabelRow`, `.ratioBtn`, `.ratioBtnActive`, `.ratioChip`; media query móvil para la altura de 24 px.

**`BulkEditPanel.tsx`**
- Estado `ratio: 2 | 3 | null`, los mismos dos modos que New Trade. Elegir un ratio fija `ratio` y vacía `tp`; la ✕ del chip pone `ratio` a `null` y vuelve a mostrar el input de precio vacío (AC 13).
- Por posición: `effectiveSl = sl ? parseFloat(sl) : p.sl`; `tpFor(p) = ratio && effectiveSl ? tpForRatio(p.openPrice, effectiveSl, isBuySide(p.type), ratio, pricePrecision(p.symbol)) ?? p.tp : (tp ? parseFloat(tp) : p.tp)`.
- El campo TP se renderiza como hoy cuando `ratio === null`; con ratio se renderiza la caja chip con ✕: `2:1 · <precio>` cuando todos los `tpFor(p)` coinciden, `2:1` solo si no (AC 12). Una lista de previsualización bajo la fila muestra `#ticket · open <precio> → TP <valor>` o `TP kept` para posiciones sin SL efectivo (maqueta).
- Envío habilitado cuando `sl || tp || ratio`; `modifyCommand(p, effectiveSl, tpFor(p))` por posición.
- CSS: el mismo juego `.tpLabelRow` / `.ratioBtn` / `.ratioChip`, más `.ratioPreview` (lista con borde, una fila por posición, 10 px de padding vertical en escritorio, filas de 44 px en móvil).

**`features/settings/DisplayTab.tsx` · `SettingsPage.tsx`**
- `DisplaySettingsForm.setupLevels: SetupLevelKey[]`; `DEFAULT_DISPLAY.setupLevels = [...SETUP_LEVEL_KEYS]`.
- Nuevo grupo "Setup levels" al final de la lista: hint `Levels listed in the New Trade panel. All off hides the panel.`, luego una rejilla de 4 columnas con tarjetas (`clave`, significado en una línea, interruptor) en escritorio, filas apiladas en móvil (maqueta). Interruptor → `onChange({ setupLevels: lista resultante en orden canónico })`.
- Significados mostrados: ECC `Cross candle close` · EMA `EMA cross price` · EVL `Fast EMA extreme` · MHL `Window high / low`.
- CSS: `.levelGrid`, `.levelCard`, `.levelKey`, `.levelMeaning`; en móvil se apilan.

## Alternativas

- **Niveles por broker del mirror (un panel por broker)**: exacto, pero las velas de los brokers difieren en fracciones de pip y el panel triplicaría su altura. Descartado; la cabecera nombra el broker usado.
- **Ratios en `localStorage`/input de ratio personalizado**: fuera de alcance por los requisitos.
- **Ratio en Edit group solo con una posición**: más simple, pero la edición en grupo es justo donde el operador tiene varias posiciones abiertas sobre el mismo setup. Se mantiene por posición con la lista de previsualización para ver el resultado antes de enviar.

## Riesgos

- Un preset mirror cuyo primer broker habilitado no tiene velas del símbolo devuelve `setup: null` → "No current setup", igual que hoy en manual.
- Falta `ask` en algunos ticks (`0`): la entrada a mercado de los buy queda en `null` → botones deshabilitados hasta que llegue un tick con `ask`; el hint lo indica.
- Redondeo: `toFixed(precision)` sobre el TP calculado, la misma precisión que usan los inputs (`step="0.00001"`); los pares JPY reciben 3 decimales.

## Maqueta

Aprobada 2026-11-01: https://claude.ai/artifact/UR82sSuiLJdZkYR8jsEJuH

Artboards: Desktop · New Trade · Mirror with levels · Desktop · New Trade · Manual (EMA hidden, ratio disabled) · Desktop · Edit group · ratio chip · Desktop · Settings › Display · Mobile · New Trade · Mirror with levels · Mobile · Edit group · Mobile · Settings › Display.
