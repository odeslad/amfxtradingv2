# CLAUDE.md — AMFX Trading v2 · Directrices del proyecto

## Estructura del proyecto

Este proyecto es un **monorrepo** dividido en tres capas bien diferenciadas:

```
amfxtradingv2/
├── ea/          # Expert Advisor (lógica de trading automatizado)
├── backend/     # API, lógica de negocio, conexión a BD
├── db/          # Esquema de base de datos, migraciones (Prisma)
└── frontend/    # Interfaz de usuario (React + TypeScript)
```

Cada capa es independiente. **No se mezclan responsabilidades entre capas.**

---

## Fases de desarrollo

El proyecto se construye en fases estrictas. **No se avanza a la siguiente fase sin completar la anterior.**

### Fase 1 — EA (Expert Advisor)
- Basado en la arquitectura del EA de `amfxtrading` (v1)
- Lógica de trading: señales de entrada/salida, gestión de riesgo, ejecución de órdenes
- El EA es la fuente de verdad de las operaciones

### Fase 2 — Comunicación EA ↔ Backend + BD
- Definir el contrato de comunicación entre el EA y el backend
- El backend expone endpoints que el EA consume
- La BD persiste el estado necesario (trades, posiciones, configuración)
- El esquema de BD se diseña en función de lo que el EA necesita reportar

### Fase 3 — Frontend + UX/UI
- Consume el backend para mostrar el estado del EA al usuario
- Buena UX/UI: claridad, rendimiento, feedback en tiempo real donde sea necesario
- No se diseña el frontend hasta que el contrato backend/EA esté estabilizado

---

## Reglas de trabajo

### Toma de decisiones
- **El usuario decide la arquitectura**, no Claude
- Claude propone opciones con pros/contras cuando hay ambigüedad
- Claude espera confirmación antes de implementar cualquier cosa no trivial

### Cambios entre capas
- Cualquier cambio que afecte a más de una capa se comunica antes de implementar
- Si un cambio en el backend rompe el contrato con el EA, se avisa explícitamente

### No hacer sin permiso
- No añadir dependencias sin proponerlo primero
- No ampliar el stack más allá del necesario
- No crear abstracciones prematuras
- No mezclar código de distintas fases en el mismo commit

---

## Stack base (provisional hasta confirmar por fase)

- **Frontend:** React + TypeScript + Vite + CSS Modules
- **Backend:** Node.js + servidor dedicado (VPS Windows)
- **BD:** PostgreSQL en el propio VPS Windows
- **EA:** basado en arquitectura v1 de `amfxtrading`, ejecutándose en el VPS
- **Auth:** JWT + HttpOnly cookies

## Despliegue e infraestructura

Todo el proyecto corre en un **servidor VPS Windows** propio, detrás de **Cloudflare** (proxy + DNS).  
A diferencia del MVP v1 (Vercel Functions + Neon), aquí **no hay servicios externos de hosting**:

| Capa     | Dónde corre         | Notas |
|----------|---------------------|-------|
| EA       | VPS Windows         | proceso Node.js o servicio Windows |
| Backend  | VPS Windows         | servidor Node.js (Express u otro, por confirmar) |
| Frontend | VPS Windows         | build estático servido desde el propio servidor |
| BD       | VPS Windows         | PostgreSQL instalado localmente |
| Proxy    | Cloudflare          | SSL, caché, protección DDoS |

**Control de versiones y despliegue:**
- Repositorio en **GitHub**
- Pipeline: push a `main` → GitHub Actions hace SSH al VPS → `git pull` + build + restart servicios
- Sin intervención manual en el servidor para desplegar

**Implicaciones de arquitectura:**
- El backend es un servidor HTTP persistente (no funciones serverless)
- El EA puede comunicarse con el backend via `localhost` (misma máquina), sin latencia de red
- Las migraciones de BD se ejecutan directamente en el VPS
- El frontend se sirve como ficheros estáticos (Nginx, IIS, o similar — por confirmar)

---

## Sistema de diseño — Bloomberg style dark

**Una única fuente de verdad visual para todo el proyecto.**  
Todos los valores de diseño se definen aquí. No se repiten valores mágicos en los componentes; siempre se usan las variables CSS definidas en esta sección.

### Paleta de colores

```css
/* Fondos */
--bg:        #0d0d0d   /* fondo base de la app */
--surface:   #161616   /* superficie primaria (cards, panels) */
--surface2:  #1e1e1e   /* superficie elevada (inputs, modales) */

/* Bordes */
--border:        rgba(255, 255, 255, 0.08)   /* divisores sutiles */
--border-bright: rgba(255, 255, 255, 0.18)   /* bordes activos/visibles */

/* Texto */
--text:   #e8e8e8   /* texto primario */
--muted:  #666666   /* texto secundario / deshabilitado */

/* Acentos */
--orange: #f5a623   /* acento principal / brand */
--blue:   #3a7bd5   /* acento secundario / info */

/* Semánticos */
--green:  #4caf84   /* éxito / buy / profit */
--red:    #e05c5c   /* error / sell / loss */
--gold:   #c8a840   /* pendiente / warning */
```

### Tipografía

```css
/* Familias */
--font-mono: 'DM Mono', monospace          /* datos, precios, números */
--font-sans: 'IBM Plex Sans', sans-serif   /* texto UI general */

/* Escala de tamaños */
--text-2xs:  9px    /* labels de formulario, badges */
--text-xs:   10px   /* títulos de sección */
--text-sm:   11px   /* texto UI principal, botones */
--text-base: 12px   /* cuerpo, timestamps */
--text-md:   13px   /* cabeceras de página */
--text-lg:   14px   /* valores de formulario, precios */
--text-xl:   16px   /* precios destacados */
--text-2xl:  20px   /* P&L principal */
--text-3xl:  28px   /* brand / login */

/* Letter-spacing */
--tracking-tight:   0.02em
--tracking-normal:  0.06em
--tracking-wide:    0.12em
--tracking-wider:   0.2em
--tracking-widest:  0.3em
```

### Espaciado

Escala base de 4px. Usar siempre múltiplos:

```
4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px
```

Valores puntuales permitidos para refinado visual: `6px`, `10px`, `14px`.

### Bordes y radios

```
border-width:   1px (estándar) · 2px (activo) · 3px (acento superior en panels)
border-radius:  0px (default) · 2px (elementos pequeños) · 3px (botones, scrollbar) · 50% (dots)
```

El lenguaje visual es **cuadrado**: la mayoría de elementos usan `border-radius: 0` o `2px`.

### Profundidad (z-index)

```
1     base / charts underlay
5     chart legend
10    tooltips, overlays, panels
50    modales
99    navegación móvil
9999  fullscreen / alertas críticas
```

### Botones

| Variante     | Fondo      | Texto     | Borde             | Hover                       |
|--------------|------------|-----------|-------------------|-----------------------------|
| primary      | `--orange` | `#000`    | —                 | `opacity: 0.85`             |
| buy          | `--green`  | `#000`    | —                 | `opacity: 0.85`             |
| sell         | `--red`    | `#fff`    | —                 | `opacity: 0.85`             |
| outlined     | transparent| `--muted` | `--border-bright` | texto → `--text`            |
| buy-outline  | transparent| `--green` | `--green`         | `rgba(76,175,132,0.15)` bg  |
| sell-outline | transparent| `--red`   | `--red`           | `rgba(224,92,92,0.15)` bg   |
| ghost        | transparent| `--muted` | —                 | texto → `--text`            |

**Tamaños:**

| Talla | Height | Font         | Padding  |
|-------|--------|--------------|----------|
| sm    | 27px   | `--text-2xs` | `0 10px` |
| md    | 34px   | `--text-sm`  | `0 14px` |
| lg    | 48px   | `--text-md`  | `0 20px` |

### Inputs

```
background:     var(--bg) o var(--surface2)
border:         1px solid var(--border-bright)
border (focus): 1px solid var(--orange)
color:          var(--text)
font:           var(--text-sm) var(--font-mono)
padding sm:     6px 8px
padding md:     7px 10px
padding lg:     0 16px, height 48px
outline:        none
transition:     border-color 0.12s
placeholder:    #333
```

### Transiciones

```
0.12s ease   → interacciones estándar (color, border, background, opacity)
0.2s ease    → movimientos de panel, slides
0.3s ease    → animaciones lentas, labels de chart
```

### Scrollbar

```css
width: 6px; border-radius: 3px;
thumb:        rgba(255, 255, 255, 0.12)
thumb:hover:  rgba(255, 255, 255, 0.22)
track:        transparent
```

### Breakpoints

```
mobile:  max-width: 768px
tablet:  max-width: 1024px
desktop: min-width: 769px
```

### Indicadores de estado

```
online  → dot 8px --green
offline → dot 8px --red
pending → dot 8px --gold, animación pulse 0.7s infinite
```

---

## Arquitectura del backend (Fase 2 — implementada)

### Comunicación EA → Backend

| Canal | Uso | Formato |
|-------|-----|---------|
| Named Pipe `\\.\pipe\mt4tick_<broker>` | Ticks en tiempo real | JSON por línea (batch) |
| Archivo `bridge/command.json` | Órdenes backend → EA | JSON con campos: `action`, `symbol`, `lots`, `sl`, `tp`, `price`, `magic`, `id` |
| Archivos `bridge/*.json` | Estado periódico (30s) | `account.json`, `positions.json`, `history.json`, `candles_SYMBOL_TF.json` |

**Backend es SERVER del pipe.** El EA es CLIENT y se conecta al iniciar.

### Acciones de comando soportadas

`buy` · `sell` · `buylimit` · `selllimit` · `buystop` · `sellstop` · `close` · `modify`

El EA responde con `bridge/result.json` → `{ "status": "ok", "ticket": 123, "id": "..." }`.

### Velas activas

Las velas activas **no se persisten en BD**. El frontend las construye desde los ticks — cada `TickData` ya contiene OHLC de todos los TF (`m5_open/high/low`, etc.) y `bid` como close. Solo velas cerradas van a la tabla `candles` (`slice(0, -1)`).

### Multi-broker

Un `PipeReader` + `FileWatcher` por broker. Config en `brokers.json` (excluido de git, nunca commitear).

### Modelos BD

`Candle` · `Position` · `Trade` · `Balance` (snapshot diario de balance por broker)

### Deploy backend

Pipeline: push `master` en `backend/**` → GitHub Actions → SCP `deploy.ps1` → SSH VPS → PowerShell.
El proceso PM2 `amfxtrading-backend` **debe estar activo** antes del deploy — si no existe, la pipeline falla.
Para arranque inicial manual: `pm2 start dist\index.js --name amfxtrading-backend && pm2 save`

---

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

### Backend general

| Item | Estado | Notas |
|------|--------|-------|
| Duplicate balance records | ⏳ pendiente | Race condition entre dos brokers al escribir simultáneamente |

---

## Referencia

El MVP de referencia está en `c:/work/odeslad/amfxtrading`.  
Se consulta para entender la lógica existente, no para copiar su estructura.
