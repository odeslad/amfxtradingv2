# CLAUDE.md — AMFX Trading v2 · Directrices del proyecto

## Estructura del proyecto

Este proyecto es un **monorrepo** dividido en tres capas bien diferenciadas:

```
amfxtradingv2/
├── ea/          # Expert Advisor (lógica de trading automatizado)
├── backend/     # API, lógica de negocio, conexión a BD (incluye prisma/ = capa db)
├── frontend/    # Interfaz de usuario (React + TypeScript)
├── infra/       # Scripts del VPS (startup, watchdog); pipelines en .github/
├── specs/       # Specs ACTIVAS: specs/NNN-<slug>/{en,es}/
├── archive/     # Specs cerradas, por mes de cierre: archive/YYYY-MM/NNN-<slug>/
├── epics/       # Ideas exploradas con /epic-explore antes de partirlas en specs (trading-engine/ = diseño del engine, no implementado)
└── reports/     # Auditorías de código (/amfx-code-audit)
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

## Workflow spec-driven (skills en `.claude/skills/`)

Todo cambio no trivial pasa por una spec. Sin sprints ni dailies: el ciclo es spec → implementación → despliegue → validación en producción → cierre.

1. `/epic-explore <idea>` (global) — explorar una idea hasta un `epics/<slug>/concept.md` con specs candidatas.
2. `/amfx-spec-new` — crear `specs/NNN-<slug>/` (requirements → design → tasks, con aprobación por documento). Cada tarea nombra su capa `[backend]`/`[frontend]`/`[ea]`/`[db]`/`[infra]`, su mecanismo de verificación y su estimación (1 SP = 1 h senior).
3. `/amfx-implement` — implementar tarea a tarea en `master`: verificar → registrar en `verification.md` → commit atómico con scope de capa (`feat(backend):`) y `Spec: NNN-<slug> (task n)` en el cuerpo → checkpoint con el usuario. Nunca push sin preguntar. La última tarea cierra la spec: Est vs Actual, `Status: closed`, `git mv` a `archive/YYYY-MM/`.
4. `/amfx-status` — tabla de specs activas (fase, tareas, verificación, capas).
5. `/amfx-branch-review <rama | rango | NNN>` — revisión de solo lectura contra `master` y contra la spec.
6. `/amfx-code-audit <backend | frontend | ea>` — auditoría de solo lectura → dos informes en `reports/`.

**Espejo de idiomas**: `en/` (fuente de trabajo) y `es/` contienen siempre los mismos documentos; cualquier cambio en uno actualiza el otro en el mismo commit.

**Gate de cierre = producción**: la penúltima tarea es siempre la validación del usuario en la app desplegada (backend primero; frontend solo cuando el usuario lo pida; EA a mano).

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

Resumen; el detalle vive en `backend/docs/architecture.md` y los dos documentos no deben contradecirse.

### Comunicación EA → Backend

Un `PipeReader` + un `FileWatcher` **por broker**, configurados en `brokers.json` (excluido de git, nunca commitear).

| Canal | Uso | Formato |
|-------|-----|---------|
| Named Pipe `\.\pipe\mt4tick_<broker>` | Ticks (100 ms), posiciones abiertas (1 s), cuenta (1 s) | Una línea JSON por mensaje: array `[...]` = batch de ticks · `{"type":"positions",...}` · `{"type":"account",...}` |
| Archivos `bridge/*.json` (el EA los escribe cada 60 s) | Persistencia; el watcher los lee cada 30 s y salta los que no cambian de `mtime`/tamaño | `candles_<SYM>_<TF>.json` → `candles` (solo velas cerradas) · `history.json` → `trades` + `balance_operations` · `account.json` → `balances` (un upsert por broker y día UTC) |
| Archivo `bridge/command.json` | Órdenes backend → EA | `action`, `symbol`, `lots`, `sl`, `tp`, `price`, `magic`, `id` |

**El backend es SERVER del pipe**; el EA es CLIENT y se conecta al iniciar. Si el `listen` falla se reintenta con backoff (1 s → 30 s). `positions.json` lo escribe el EA pero nadie lo lee: las posiciones solo viven en memoria (`store/positions`) y se emiten por WS, no se persisten.

### Comandos

`POST /commands` escribe `command.json` (como `.tmp` + rename) y responde `202 { status: "pending", id }`. Acciones: `buy` · `sell` · `buylimit` · `selllimit` · `buystop` · `sellstop` · `close` · `modify`. El EA responde con `result.json` → `{ "status", "ticket", "id", "message" }`; mientras `pending.json` lleve el mismo `id` la espera se alarga de 10 s a 30 s. Si expira y `command.json` sigue ahí, el backend lo retira y emite `cancelled`; si no, emite `timeout` y un resultado que llegue en los 60 s siguientes se emite con `late: true`. El resultado siempre llega por WS como `command_result`. Con `lotsMode: "risk_pct"` el backend calcula los lotes desde la distancia al SL (`services/sizing.ts`, solo pares forex) y rechaza con 400/503 cuando no puede.

### WebSocket `/ws`

Upgrade solo con `Origin` permitido y cookie JWT válida; ping cada 30 s; backpressure por `bufferedAmount`. Mensajes `{ type, broker, ... }` con el `broker` en la **raíz**, no por item (el front lo inyecta antes de ordenar): `ticks` · `positions` (con bid/ask actual y color) · `account` · `command_result` · `alert` · `ema_alert` (los dos últimos solo a su dueño).

### Velas activas y alertas

Las velas activas **no se persisten**: cada tick trae OHLC de todos los TF (`m5_open/high/low`, `h1_time`, …) y el frontend construye la vela en curso; a `candles` solo van las cerradas (`slice(0, -1)`). Las alertas de precio se evalúan en cada tick (cruce del bid con el nivel); las de EMA, al cierre de vela (cambio de `<tf>_time`) cuando las EMAs convergen dentro del umbral. Al dispararse: BD + WS + Web Push.

### HTTP y auth

Express con 16 routers (`/auth`, `/commands`, `/trades`, `/positions`, `/balances`, `/settings`, `/symbols`, `/candles`, `/chart-indicators`, `/drawings`, `/alerts`, `/ema-alerts`, `/scanner`, `/setup-levels`, `/push`, `/stats`) más `GET /health` (sin auth, vitalidad por broker). JWT en cookie HttpOnly `token`; `requireAuth` en todo salvo `/auth` y `/health`. Parámetros validados (400), errores no controlados al handler final (500) sin tumbar el proceso.

### Modelos BD

`Candle` · `Trade` · `Balance` (snapshot diario por broker y día UTC) · `BalanceOperation` · `SettingsMirror` · `SettingsDisplay` · `PositionColor` · `User` · `PriceAlert` · `EmaCrossAlert` · `PushSubscription` · `Drawing` · `ChartIndicators`. Migraciones SQL escritas a mano en `backend/prisma/migrations/`; `prisma migrate diff` contra producción debe salir vacío.

### Feature flags y entorno

`FEATURE_PIPE` / `FEATURE_WATCHER` / `FEATURE_ALERTS` / `FEATURE_WS_BROADCAST` se apagan solo con el valor literal `false` (así corre un backend local contra la BD de producción sin tocar los bridges). Variables completas y comentadas en `backend/.env.example`.

### Deploy backend

Pipeline: push `master` en `backend/**` → GitHub Actions (checks) → SCP `deploy.ps1` → SSH VPS → PowerShell: `git pull` → `pm2 delete` → liberar el puerto 3000 (mata huérfanos propios; si el puerto lo ocupa un proceso ajeno, falla explícitamente) → `npm install` → `prisma generate` → `prisma migrate deploy` → build en `dist.next` → swap → `pm2 start` → `/health`. Si algo falla tras el build se restaura el `dist` anterior.

---

## Referencia

El MVP de referencia está en `c:/work/odeslad/amfxtrading`.  
Se consulta para entender la lógica existente, no para copiar su estructura.
