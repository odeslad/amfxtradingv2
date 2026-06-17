# HttpBridgeState — Documentación

**Versión:** 2.21  
**Archivo:** `ea/HttpBridgeState.mq4`  
**Rol:** Emisor continuo del estado de MT4 hacia el backend (precios, posiciones, historial, velas).

---

## Propósito

Este EA actúa como el **sistema de telemetría** del bridge. Transmite en tiempo real todo lo que ocurre en MT4 al backend Node.js: ticks de precio con datos de velas en formación, posiciones abiertas, datos de cuenta e historial de operaciones.

---

## Arquitectura de comunicación

Usa **dos canales en paralelo**:

```
MT4 (OnTick — cada tick)
      │
      │  JSON via Named Pipe (push, async, no-blocking)
      ▼
\\.\pipe\mt4tick  ──────────────►  Backend Node.js (pipe server)


MT4 (OnTimer — cada 1s)
      │
      │  escritura a archivos JSON
      ▼
bridge/account.json
bridge/positions.json
bridge/history.json          ──►  Backend Node.js (lee periódicamente)
bridge/candles_SYM_TF.json
```

### ¿Por qué dos canales?

- **Pipe** → para datos que necesitan baja latencia: precios y velas en formación (cada tick, throttleado a 100ms)
- **Archivos** → para datos que no necesitan ser en tiempo real: posiciones, cuenta, historial, velas históricas

---

## Ciclo de vida

### 1. Inicio (`OnInit`)
1. Crea el evento Windows para I/O asíncrono (`CreateEventW`)
2. Registra un timer de **1 segundo**
3. Escribe las velas históricas iniciales: **5 timeframes × hasta 5000 barras**
   - M5, M15, H1, H4, D1
4. Marca como listo para streaming

### 2. Cada tick (`OnTick`)
1. Construye un JSON con precio bid/ask actual + datos de las 5 velas en formación (una por timeframe)
2. Guarda el JSON en memoria (`pendingTick`) — siempre sobreescribe el anterior
3. Si han pasado al menos **100ms** desde el último envío → envía por pipe
4. Si el envío falla → no actualiza el timestamp, el siguiente tick reintentará inmediatamente

### 3. Cada segundo (`OnTimer`)
1. Escribe `positions.json` con todas las posiciones abiertas
2. Escribe `account.json` con el estado de la cuenta
3. Cada **60 segundos**: escribe `history.json` con las últimas 50 operaciones cerradas
4. Cada **REFRESH_EVERY segundos** (defecto 30): reescribe las velas recientes (RECENT_BARS barras por timeframe)

### 4. Parada (`OnDeinit`)
- Cierra el pipe y el event handle de Windows
- Imprime motivo de parada

---

## Datos transmitidos por pipe (tick JSON)

Enviado en cada tick (máximo 1 vez cada 100ms):

```json
{
  "broker": "ftmo",
  "symbol": "EURUSD",
  "bid": 1.08432,
  "ask": 1.08435,
  "time": 1718620800000,
  "broker_offset": 7200,
  "m5_time":  1718620500000,
  "m5_open":  1.08410,
  "m5_high":  1.08445,
  "m5_low":   1.08398,
  "m15_time": 1718619600000,
  "m15_open": 1.08380,
  "m15_high": 1.08450,
  "m15_low":  1.08370,
  "h1_time":  1718618400000,
  "h1_open":  1.08300,
  "h1_high":  1.08460,
  "h1_low":   1.08280,
  "h4_time":  1718604000000,
  "h4_open":  1.08150,
  "h4_high":  1.08470,
  "h4_low":   1.08100,
  "d1_time":  1718496000000,
  "d1_open":  1.07900,
  "d1_high":  1.08470,
  "d1_low":   1.07850
}
```

| Campo | Descripción |
|-------|-------------|
| `broker` | Nombre del broker (parámetro de entrada) |
| `symbol` | Símbolo del gráfico donde está adjunto el EA |
| `bid` / `ask` | Precios actuales con 5 decimales |
| `time` | Timestamp UTC en milisegundos |
| `broker_offset` | Diferencia en segundos entre hora del broker y UTC |
| `{tf}_time` | Timestamp de apertura de la vela en formación (ms) |
| `{tf}_open/high/low` | OHLC parcial de la vela actual (sin `close`, es la vela viva) |

---

## Datos escritos en archivos

### `bridge/account.json`
```json
{
  "balance": 10000.00,
  "equity": 10045.32,
  "profit": 45.32,
  "margin": 120.50,
  "freeMargin": 9924.82,
  "leverage": 100,
  "currency": "USD",
  "name": "John Doe",
  "number": 1234567
}
```

### `bridge/positions.json`
Array de posiciones abiertas (actualizado cada 1s):
```json
[
  {
    "ticket": 12345,
    "symbol": "EURUSD",
    "type": 0,
    "lots": 0.10,
    "openPrice": 1.08350,
    "sl": 1.08100,
    "tp": 1.08600,
    "profit": 82.00,
    "swap": -0.50,
    "commission": -3.50,
    "magic": 42,
    "comment": "HttpBridge",
    "openTime": "2024.06.17 09:30"
  }
]
```

`type`: 0 = BUY, 1 = SELL, 2-5 = órdenes pendientes.

### `bridge/history.json`
Últimas 50 operaciones cerradas (actualizado cada 60s). Mismo formato que `positions.json` más los campos `closePrice` y `closeTime`.

### `bridge/candles_SYMBOL_TF.json`
Velas históricas por símbolo y timeframe (ej. `candles_EURUSD_M15.json`):
```json
{
  "brokerOffset": 7200,
  "candles": [
    { "time": 1718619600, "open": 1.08380, "high": 1.08450, "low": 1.08370, "close": 1.08432 },
    ...
  ]
}
```
`time` en segundos Unix (sin milisegundos). El backend aplica `brokerOffset` para convertir a UTC.

---

## Gestión del pipe (Named Pipe)

### Conexión
- El EA intenta conectar al pipe `\\.\pipe\mt4tick` al arrancar y en cada tick si está desconectado
- Si el backend no está corriendo → falla silenciosamente y reintenta en el siguiente tick
- Reconexión periódica forzada cada **30 segundos** para liberar handles obsoletos

### Escritura asíncrona (Overlapped I/O)
Para no bloquear MT4 durante la escritura:
1. Inicia `WriteFile` con flag `FILE_FLAG_OVERLAPPED` → retorna inmediatamente
2. Espera la señal del evento Windows con timeout de **8ms**
3. Si completa en < 8ms → éxito
4. Si supera 8ms → cancela la escritura con `CancelIo`

### Gestión de timeouts consecutivos

| Timeouts consecutivos | Acción |
|-----------------------|--------|
| 1–2 | Log de aviso, reintento en siguiente tick |
| 3 (`MAX_TIMEOUTS`) | Cierra el pipe y reconecta |

---

## Logs en terminal MT4

| Prefijo | Evento |
|---------|--------|
| `[STATE] HttpBridgeState v2.21 \| broker: ... symbol: ...` | Inicio del EA |
| `[STATE] Writing historical candles (5 timeframes × 5000 bars)...` | Inicio de escritura inicial |
| `[STATE] Candles written \| EURUSD M15 bars: 4999 offset: 7200s` | Confirmación por timeframe |
| `[STATE] Init complete \| ready to stream ticks` | EA listo |
| `[PIPE] Connected \| broker: ...` | Pipe conectado al backend |
| `[PIPE] Disconnected \| broker: ...` | Pipe cerrado |
| `[PIPE] Connection failed \| broker: ...` | No se pudo conectar (backend offline) |
| `[PIPE] Periodic reconnect \| broker: ...` | Reconexión periódica cada 30s |
| `[PIPE] Write timeout #N \| broker: ...` | Timeout de escritura |
| `[PIPE] Dead after N timeouts — reconnecting` | Pipe declarado muerto, reconectando |
| `[STATE] Positions update \| open: N` | Cambio en número de posiciones abiertas |
| `[STATE] History refreshed` | Historial reescrito (cada 60s) |
| `[STATE] Refreshing candles (100 bars × 5 tf)` | Actualización periódica de velas |
| `[STATE] ERROR: could not write file: ...` | Error al escribir un archivo |
| `[STATE] Stopped \| reason: N` | EA detenido |

---

## Parámetros de entrada (MT4 Inputs)

| Parámetro | Defecto | Descripción |
|-----------|---------|-------------|
| `BROKER_NAME` | `"ftmo"` | Identificador del broker incluido en cada tick JSON |
| `RECENT_BARS` | `100` | Barras a reescribir en cada ciclo de refresco de velas |
| `REFRESH_EVERY` | `30` | Segundos entre cada refresco periódico de velas |

---

## Throttle de ticks

MT4 puede generar decenas de ticks por segundo. El EA limita el envío por pipe a **1 tick cada 100ms** para no saturar el pipe ni el backend. El tick que se envía es siempre el más reciente (last-write-wins): si llegan 5 ticks en 100ms, se envía solo el último.

---

## Dependencias

- **`kernel32.dll`** — para I/O asíncrono con Named Pipes (viene con Windows, no requiere instalación)
- **Backend Node.js corriendo** — debe tener el servidor de pipe escuchando en `\\.\pipe\mt4tick`
- **Carpeta `bridge\`** — debe existir en `MQL4/Files/`
- **Coordinación** con `HttpBridgeCommands.mq4` — ambos EAs en el mismo símbolo/gráfico

---

## Notas de instalación

1. Copiar `HttpBridgeState.mq4` a `MQL4/Experts/`
2. Compilar en MetaEditor
3. Adjuntar al **mismo gráfico** que `HttpBridgeCommands` (mismo símbolo)
4. Asegurarse de que el backend Node.js está corriendo **antes** de arrancar el EA para que el pipe conecte al inicio
5. Si el backend arranca después, el EA conectará automáticamente en el siguiente tick
