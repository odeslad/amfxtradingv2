# Trading Engine — concept (moved from CLAUDE.md)

> Moved on 2026-10-08 by spec 015 (BE-10). Design notes written during Fase 2 for an engine that was
> started and then removed in spec 001; nothing below is implemented. Split into specs with /amfx-spec-new
> when the engine is taken up again. Open items at the time of the move: trailing `riskCut`, levels `EMCC`
> and `SHL`, entry distance filters, realtime mode.

## Trading Engine (Fase 2 — en diseño)

Engine que procesa ticks en tiempo real, evalúa estrategias almacenadas en BD y genera órdenes al EA.

### Flujo

```
tick → candle-tracker → strategy-evaluator → order-executor → bridge/command.json → EA
```

### Componentes previstos en `backend/src/engine/`

- `candle-tracker.ts` — detecta cierre de vela comparando `m5_time`/`h1_time`/etc. entre ticks
- `strategy-evaluator.ts` — carga estrategias activas de BD y evalúa su JSON de config
- `order-executor.ts` — escribe `bridge/command.json` en el bridge path del broker
- `engine.ts` — orquesta todo

### Modelo BD `Strategy`

Campos: broker, symbol, timeframe, config (JSON), activa/inactiva.
El campo `config` contiene la estructura completa de la estrategia descrita abajo.

---

## Diseño del sistema de estrategias

### Jerarquía

```
Strategy (config JSON)
├── forms[]          → Setups (uno o varios)
│   ├── context      → Parámetros del setup (ej. emaFast, emaSlow, direction)
│   └── entries[]    → Entries del setup (ECC, EMCC, EMA, EVL, SHL, MHL)
├── weakConfig       → Condiciones de vela weak
├── strongConfig     → Condiciones de vela strong
├── brokerSettings[] → Config por broker (lots, lotsMode, enabled)
├── engineEnabled    → boolean
└── engineMode       → "live" | "backtest"
```

---

### Setup — estructura base (`form`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | UUID |
| `name` | `string` | Nombre descriptivo |
| `instrument` | `string` | Símbolo (ej. `EURUSD`) |
| `timeframe` | `string` | TF del setup (ej. `H1`) |
| `contextType` | `string` | Tipo de setup (ej. `ema_cross`) |
| `context` | `object` | Parámetros específicos del tipo de setup |
| `entries` | `Entry[]` | Lista de entries del setup |

---

### Setup: EMA Cross (`contextType: "ema_cross"`)

#### Context

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `emaFast` | `number` | Periodo EMA rápida |
| `emaSlow` | `number` | Periodo EMA lenta |
| `direction` | `"buy" \| "sell"` | Dirección del cruce |
| `sequential` | `boolean` | Si requiere setups secuenciales |
| `minPrevContextCandles` | `number` | Mínimo de velas del setup anterior |
| `minPrevEmaSpreadPips` | `number \| null` | Spread mínimo de EMAs en setup anterior |
| `minContextVolPct` | `number \| null` | Filtro de volumen mínimo (%) |
| `emaFilter` | `object \| null` | Filtro de EMA externo (a definir) |

#### Niveles del setup

| Clave | Nombre completo | Descripción |
|-------|----------------|-------------|
| `ECC` | EMA Cross Candle | Precio de cierre de la vela de activación |
| `EMCC` | (a confirmar) | — |
| `EMA` | EMA Level | Nivel interpolado del cruce exacto de las EMAs |
| `EVL` | EMA Valley Level | Mínimo local de la EMA rápida entre el cruce anterior y el actual |
| `SHL` | Setup High/Low | (a confirmar) |
| `MHL` | Min/Max Historical Level | Mínimo del setup anterior (alcista) / Máximo (bajista) |

#### Clasificación de velas

| Tipo | Condición (alcista) |
|------|-------------------|
| `weak` | Cierra por debajo de las dos EMAs + separación ≥ umbral. Parámetros en `weakConfig` |
| `strong` | Cierra por encima de las dos EMAs + separación ≥ umbral. Parámetros en `strongConfig` |

**`weakConfig`**
```json
{
  "maxSpreadPips": 10,
  "useMaxSpread": true,
  "requireNewLow": true,
  "enabled": true,
  "requireContrarySlopes": true,
  "requireCloseVsSlowEma": true
}
```

**`strongConfig`**
```json
{
  "minSpreadPips": 2,
  "useMinSpread": true,
  "requireNewHigh": true
}
```

---

### Entries — estructura común

Todos los tipos de entry comparten estos campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | `"ECC"\|"EMCC"\|"EMA"\|"EVL"\|"SHL"\|"MHL"` | Nivel de entrada |
| `enabled` | `boolean` | Activa/desactiva la entry |
| `invert` | `boolean` | Invierte la dirección de la operación |
| `offset` | `number` | Ajuste en pips sobre el nivel |
| `window` | `number` | Ventana de velas para activación (desde la activación del setup) |
| `maxDistToEma` | `number \| null` | Filtro: distancia máxima al nivel EMA (pips) |
| `maxDistToEvl` | `number \| null` | Filtro: distancia máxima al nivel EVL (pips) |
| `maxDistToShl` | `number \| null` | Filtro: distancia máxima al nivel SHL (pips) |
| `shlThreshold` | `number` | Umbral para cálculo de SHL |
| `evlLookback` | `number` | Velas hacia atrás para buscar el EVL |
| `sl` | `SLConfig` | Config del Stop Loss |
| `trail` | `TrailConfig` | Config del Trailing |
| `exit` | `ExitConfig` | Config del Take Profit |
| `sizing` | `SizingConfig` | Config del tamaño de posición |

#### SL Config
```json
{
  "type": "fixed" | "evl",
  "pips": number,
  "minPips": number | null,
  "maxPips": number | null,
  "evlOffset": number
}
```

#### Trail Config
```json
{
  "type": "none" | "weak" | "riskCut",
  "offset": number,
  "distance": number,
  "weakCount": number,
  "weakPivotLen": number,
  "pivotThreshold": number,
  "toBeEnabled": boolean,
  "toRR": number | null,
  "minCandles": number | null,
  "minProfitPips": number | null,
  "activateCandles": number | null,
  "activateRatio": number | null,
  "activateMode": "and" | "or",
  "riskReduction": { "enabled": boolean, "pct": number, "candles": number },
  "updateEvery": number
}
```

#### Exit Config
```json
{
  "type": "none" | "fixed" | "rr",
  "pips": number | null,
  "rr": number | null,
  "reverseOffset": number
}
```

#### Sizing Config
```json
{
  "sizeMode": "lots" | "risk_pct",
  "lots": number,
  "riskPercent": number,
  "compounding": boolean,
  "sizingFilter": {
    "enabled": boolean,
    "emaFast": number,
    "emaSlow": number,
    "timeframe": string,
    "multiplier": number
  }
}
```

---

---

### Modos del evaluador de estrategias

#### Modo backtest
- Recibe un intervalo histórico de velas (de BD)
- Evalúa la estrategia sobre todo el histórico y genera todas las operaciones encontradas
- Persiste los resultados en BD bajo un `BacktestRun`
- **Caché:** si la estrategia no ha cambiado sus parámetros desde el último run, reutiliza los resultados sin reevaluar
- El frontend consume estos resultados para visualizar setups y trades del backtest

**Jerarquía en BD:**
```
Strategy
└── BacktestRun          — cada evaluación completa de la estrategia
    └── BacktestSetup    — cada setup detectado en el run (con sus niveles y características)
        └── BacktestTrade — cada operación encontrada dentro del setup
```

**`BacktestRun`:** strategyId, broker, symbol, timeframe, fechaInicio, fechaFin, configHash (para detectar cambios de parámetros), createdAt

**`BacktestSetup`:** runId, dirección (buy/sell), vela de activación, precio de activación, vela de cierre, precio de cierre, niveles JSON (ECC, EMA, EVL, MHL...), candleCount

**`BacktestTrade`:** setupId, entryType (ECC/EMA/EVL...), precio entrada, SL, TP, vela de entrada, vela de cierre, resultado (pips, RR), status (win/loss/breakeven/open)

#### Modo realtime
- A definir en detalle — analiza y toma decisiones en tiempo real al cierre de cada vela
- Decide si ejecutar una operación o no según las condiciones de la estrategia

---

### Broker Settings (por estrategia)

```json
"brokerSettings": [
  { "broker": "ftmo", "enabled": boolean, "lotsMode": "fixed" | "auto", "lots": number }
]
```

Permite activar/desactivar la estrategia por broker y sobreescribir el sizing.

### Magic number

Constante fija del engine. Solo gestiona posiciones abiertas por él (filtradas por magic number). Las posiciones abiertas manualmente o por el EA autónomo no son gestionadas por el engine (no las cierra ni modifica), pero siguen activas en MT4 y se sincronizan en BD via `positions.json`.

---

## Pendiente backend (Fase 2)

### Engine — evaluador

| Item | Estado | Notas |
|------|--------|-------|
| Trailing `riskCut` | ⏳ pendiente | A definir con el usuario |
| Nivel `EMCC` | ⏳ pendiente | Definición "a confirmar" |
| Nivel `SHL` | ⏳ pendiente | Definición "a confirmar" |
| Filtros de entry (`maxDistToEma`, `maxDistToEvl`, `maxDistToShl`) | ⏳ pendiente | No implementados en entry-evaluator |
| Modo realtime del evaluador | ⏳ pendiente | A definir en detalle |


