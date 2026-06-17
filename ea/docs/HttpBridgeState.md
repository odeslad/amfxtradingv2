# HttpBridgeState — Documentación

**Versión:** 3.00  
**Archivo:** `ea/HttpBridgeState.mq4`  
**Rol:** Emisor continuo del estado de MT4 hacia el backend (precios, velas en formación, posiciones, historial, cuenta).

---

## Propósito

Este EA actúa como el **sistema de telemetría** del bridge. Transmite en tiempo real las cotizaciones y velas en formación de todos los símbolos configurados al backend Node.js, y periódicamente envía el estado completo (posiciones abiertas, historial, datos de cuenta y velas históricas).

---

## Arquitectura de comunicación

Usa **dos canales en paralelo**:

```
MT4 (OnTimer — cada 100ms)
      │
      │  JSON array via Named Pipe (push, async, no-blocking)
      ▼
\\.\pipe\mt4tick  ──────────────►  Backend Node.js (pipe server)
      │
      │  cada STATE_EVERY_S segundos (defecto 60s)
      │  escritura a archivos JSON
      ▼
bridge/account.json
bridge/positions.json              ──►  Backend Node.js (lee periódicamente)
bridge/history.json
bridge/candles_SYM_TF.json
```

### ¿Por qué dos canales?

- **Pipe** → datos que necesitan baja latencia: cotizaciones y velas en formación de todos los símbolos (cada 100ms)
- **Archivos** → datos que no necesitan tiempo real: posiciones, cuenta, historial, velas históricas (cada 60s)

---

## Rendimiento

| | v2.21 (anterior) | v3.0 (actual) |
|---|---|---|
| Símbolos soportados | 1 | N (configurable) |
| Frecuencia de tick | OnTick (50-100×/s en mercado activo) | OnTimer fijo 10×/s |
| Mensajes por pipe | 1 objeto JSON por envío | 1 array JSON con todos los símbolos |
| Escritura de estado | Cada 1s (posiciones/cuenta) + cada 30s (velas) | Cada 60s (todo junto) |
| Overhead por tick | Construye JSON en cada tick aunque no envíe | Solo construye en el timer |

**v3.0 es más eficiente** con múltiples símbolos: menos eventos, menos escrituras en pipe, intervalo de estado más largo. La construcción del JSON para N símbolos es despreciable (operación en memoria).

---

## Ciclo de vida

### 1. Inicio (`OnInit`)
1. Parsea el parámetro `SYMBOLS` y construye la lista interna de símbolos
2. Crea el evento Windows para I/O asíncrono (`CreateEventW`)
3. Registra un timer de **100ms** (`EventSetMillisecondTimer`)
4. Escribe las velas históricas iniciales: **N símbolos × 5 timeframes × hasta 5000 barras**

### 2. Cada 100ms (`OnTimer`)
1. Construye un array JSON con la cotización completa de todos los símbolos
2. Envía el array por pipe al backend
3. Si han pasado `STATE_EVERY_S` segundos → actualiza posiciones, cuenta, historial y velas recientes

### 3. Parada (`OnDeinit`)
- Cancela el timer
- Cierra el pipe y el event handle de Windows

---

## Parámetros de entrada (MT4 Inputs)

| Parámetro | Defecto | Descripción |
|-----------|---------|-------------|
| `BROKER_NAME` | `"ftmo"` | Identificador del broker, incluido en cada mensaje |
| `SYMBOLS` | `"EURUSD"` | Lista de símbolos separados por coma |
| `RECENT_BARS` | `100` | Barras a reescribir en cada actualización periódica de velas |
| `STATE_EVERY_S` | `60` | Segundos entre cada actualización de estado (posiciones, cuenta, historial, velas) |

**Ejemplo con múltiples símbolos:**
```
SYMBOLS = "EURUSD,XAUUSD,BTCUSD,GBPUSD,USDJPY,EURJPY,GBPJPY,AUDUSD,USDCAD,USDCHF"
```

Los símbolos deben estar presentes en el **Market Watch** de MT4 y tener historial cargado.

---

## Formato del mensaje de tick (pipe)

Enviado cada 100ms. Array JSON con un objeto por símbolo configurado:

```json
[
  {
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
  },
  {
    "symbol": "XAUUSD",
    ...
  }
]
```

| Campo | Descripción |
|-------|-------------|
| `symbol` | Símbolo del instrumento |
| `bid` / `ask` | Cotización actual con 5 decimales |
| `time` | Timestamp UTC en milisegundos |
| `broker_offset` | Diferencia en segundos entre hora del broker y UTC |
| `{tf}_time` | Timestamp de apertura de la vela en formación (ms) |
| `{tf}_open/high/low` | OHLC parcial de la vela viva (sin `close` — la vela no ha cerrado) |

Los timeframes incluidos: **M5, M15, H1, H4, D1**.

---

## Datos escritos en archivos (cada `STATE_EVERY_S`)

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
Array de todas las posiciones abiertas:
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
Últimas 50 operaciones cerradas. Mismo formato que `positions.json` más `closePrice` y `closeTime`.

### `bridge/candles_SYMBOL_TF.json`
Un archivo por símbolo y timeframe (ej. `candles_EURUSD_M15.json`):
```json
{
  "brokerOffset": 7200,
  "candles": [
    { "time": 1718619600, "open": 1.08380, "high": 1.08450, "low": 1.08370, "close": 1.08432 },
    ...
  ]
}
```

`time` en segundos Unix. El backend aplica `brokerOffset` para convertir a UTC.

---

## Gestión del pipe (Named Pipe)

### Conexión
- Intenta conectar al pipe `\\.\pipe\mt4tick` al necesitar enviar
- Si el backend no está corriendo → falla silenciosamente, reintenta en el siguiente ciclo de 100ms
- Reconexión forzada cada **30 segundos** para liberar handles obsoletos

### Escritura asíncrona (Overlapped I/O)
Para no bloquear MT4 durante la escritura:
1. Inicia `WriteFile` con `FILE_FLAG_OVERLAPPED` → retorna inmediatamente
2. Espera la señal del evento Windows con timeout de **8ms**
3. Si completa en < 8ms → éxito
4. Si supera 8ms → cancela con `CancelIo`

### Gestión de timeouts consecutivos

| Timeouts consecutivos | Acción |
|-----------------------|--------|
| 1–2 | Log de aviso, reintento en siguiente ciclo |
| 3 | Cierra el pipe y reconecta |

---

## Logs en terminal MT4

| Prefijo | Evento |
|---------|--------|
| `[STATE] HttpBridgeState v3.0 \| broker: ... symbols: ... symbol count: N` | Inicio del EA |
| `[STATE] Writing historical candles (N symbols × 5 timeframes × 5000 bars)...` | Inicio de escritura inicial |
| `[STATE] Candles written \| EURUSD M15 bars: 4999 offset: 7200s` | Confirmación por símbolo y timeframe |
| `[STATE] Init complete \| ready to stream ticks` | EA listo |
| `[PIPE] Connected \| broker: ...` | Pipe conectado al backend |
| `[PIPE] Disconnected \| broker: ...` | Pipe cerrado |
| `[PIPE] Connection failed \| broker: ...` | No se pudo conectar (backend offline) |
| `[PIPE] Periodic reconnect \| broker: ...` | Reconexión periódica cada 30s |
| `[PIPE] Write timeout #N \| broker: ...` | Timeout de escritura |
| `[PIPE] Dead after N timeouts — reconnecting` | Pipe declarado muerto, reconectando |
| `[STATE] Positions update \| open: N` | Cambio en número de posiciones abiertas |
| `[STATE] State updated \| positions: N` | Actualización periódica de estado |
| `[STATE] Refreshing candles (100 bars × 5 tf × N symbols)` | Actualización periódica de velas |
| `[STATE] ERROR: could not write file: ...` | Error al escribir un archivo |
| `[STATE] Stopped \| reason: N` | EA detenido |

---

## Dependencias

- **`kernel32.dll`** — para I/O asíncrono con Named Pipes (incluido en Windows)
- **Backend Node.js corriendo** — debe tener el servidor de pipe escuchando en `\\.\pipe\mt4tick`
- **Carpeta `bridge\`** — debe existir en `MQL4/Files/`
- **Símbolos en Market Watch** — todos los símbolos de `SYMBOLS` deben estar suscritos en MT4
- **Coordinación** con `HttpBridgeCommands.mq4` — ambos EAs adjuntos al mismo gráfico

---

## Notas de instalación

1. Copiar `HttpBridgeState.mq4` a `MQL4/Experts/`
2. Compilar en MetaEditor
3. Adjuntar al gráfico (el símbolo del gráfico es irrelevante — los datos se leen de `SYMBOLS`)
4. Configurar el parámetro `SYMBOLS` con todos los instrumentos deseados
5. Asegurarse de que todos los símbolos están en el Market Watch con historial disponible
6. Arrancar el backend Node.js **antes** de activar el EA para que el pipe conecte al inicio
