# HttpBridgeCommands — Documentación

**Versión:** 2.11  
**Archivo:** `ea/HttpBridgeCommands.mq4`  
**Rol:** Receptor y ejecutor de órdenes enviadas desde el backend al broker MT4.

---

## Propósito

Este EA actúa como el **brazo ejecutor** del sistema. No genera señales ni toma decisiones de trading. Su única responsabilidad es leer comandos enviados por el backend Node.js y ejecutarlos en MT4 (abrir, cerrar o modificar órdenes).

---

## Arquitectura de comunicación

La comunicación es **pull** mediante sistema de archivos:

```
Backend Node.js
      │
      │  escribe
      ▼
bridge/command.json
      │
      │  lee cada 1s (OnTimer)
      ▼
HttpBridgeCommands
      │
      │  ejecuta en MT4
      │  escribe resultado
      ▼
bridge/result.json
bridge/pending.json
```

Los archivos viven en la carpeta `bridge\` dentro del directorio de datos de MT4  
(`MQL4/Files/bridge/`).

---

## Ciclo de vida

### 1. Inicio (`OnInit`)
- Registra un timer de **1 segundo**
- Imprime en el log: versión y broker configurado

### 2. Cada segundo (`OnTimer`)
- Llama a `CheckCommands()`
- Si no existe `bridge/command.json` → no hace nada
- Si existe → lo lee, lo borra y llama a `ExecuteCommand()`

### 3. Ejecución (`ExecuteCommand`)
1. Extrae los campos del JSON recibido
2. Escribe `bridge/pending.json` (señal de "procesando" para el backend)
3. Ejecuta la acción correspondiente en MT4
4. Escribe el resultado en `bridge/result.json`
5. Borra `bridge/pending.json`

### 4. Parada (`OnDeinit`)
- Cancela el timer
- Borra `bridge/pending.json`
- Imprime en el log: motivo de parada

---

## Formato del comando (`command.json`)

```json
{
  "action": "buy",
  "symbol": "EURUSD",
  "lots": 0.10,
  "sl": 1.08500,
  "tp": 1.09500,
  "price": 0,
  "id": "cmd-abc123",
  "magic": 42
}
```

| Campo    | Tipo   | Descripción |
|----------|--------|-------------|
| `action` | string | Acción a ejecutar (ver tabla de acciones) |
| `symbol` | string | Símbolo del instrumento (`EURUSD`, `XAUUSD`...) |
| `lots`   | number | Tamaño de la posición en lotes |
| `sl`     | number | Stop Loss en precio (0 = sin SL) |
| `tp`     | number | Take Profit en precio (0 = sin TP) |
| `price`  | number | Precio límite (solo para órdenes pendientes) |
| `id`     | string | Identificador único del comando |
| `magic`  | int    | Número mágico para identificar la orden en MT4 |

Para `close` y `modify`, el campo `ticket` es obligatorio:

```json
{
  "action": "close",
  "ticket": 12345,
  "id": "cmd-xyz789"
}
```

---

## Acciones soportadas

| Acción       | Descripción | Precio de ejecución |
|--------------|-------------|---------------------|
| `buy`        | Abrir compra a mercado | ASK actual |
| `sell`       | Abrir venta a mercado | BID actual |
| `buylimit`   | Orden límite de compra | `price` del comando |
| `selllimit`  | Orden límite de venta | `price` del comando |
| `buystop`    | Orden stop de compra | `price` del comando |
| `sellstop`   | Orden stop de venta | `price` del comando |
| `close`      | Cerrar posición abierta o eliminar orden pendiente | BID/ASK actual |
| `modify`     | Modificar SL/TP de una posición existente | — |

---

## Formato de respuesta (`result.json`)

**Éxito:**
```json
{ "status": "ok", "ticket": 12345, "id": "cmd-abc123" }
```

**Éxito sin ticket** (close/modify):
```json
{ "status": "ok", "id": "cmd-abc123" }
```

**Error:**
```json
{ "status": "error", "code": 130, "id": "cmd-abc123" }
```

Los códigos de error son los estándar de MT4 (130 = invalid stops, 138 = requote, etc.).

---

## Formato de estado intermedio (`pending.json`)

Se escribe **antes** de ejecutar la orden y se borra en cuanto se escribe `result.json`.  
Permite al backend detectar si un comando está siendo procesado (útil para timeouts y reintentos):

```json
{
  "status": "processing",
  "id": "cmd-abc123",
  "action": "buy",
  "symbol": "EURUSD"
}
```

| Campo | Descripción |
|-------|-------------|
| `status` | Siempre `"processing"` mientras el EA está ejecutando |
| `id` | El mismo `id` del comando recibido |
| `action` | La acción que se está ejecutando |
| `symbol` | El símbolo de la orden |

---

## Lógica de cierre (`close`)

El cierre tiene reintentos automáticos para gestionar requotes o mercado ocupado:

1. Selecciona la orden por ticket
2. Si es posición abierta (BUY/SELL): intenta `OrderClose` hasta **5 veces** con pausa de 500ms entre intentos
3. Si es orden pendiente: ejecuta `OrderDelete`
4. Logea cada intento fallido

---

## Logs en terminal MT4

| Prefijo | Evento |
|---------|--------|
| `[CMD] HttpBridgeCommands v2.11 \| broker: ...` | Inicio del EA |
| `[CMD] Received: action=... symbol=... lots=...` | Comando recibido |
| `[CMD] OK: buy executed \| ticket=12345 ...` | Orden ejecutada con éxito |
| `[CMD] OK: close executed \| ticket=12345 ...` | Cierre ejecutado |
| `[CMD] OK: modify executed \| ticket=12345 ...` | Modificación ejecutada |
| `[CMD] ERROR: buy failed \| code=130 ...` | Error de ejecución |
| `[CMD] Close attempt 2/5 failed \| ticket=...` | Reintento de cierre |
| `[CMD] WARN: pending.json already exists — EA may have crashed or restarted mid-execution` | El EA detecta un `pending.json` huérfano al arrancar, señal de que se cayó o reinició a mitad de una ejecución anterior |
| `[CMD] ERROR: could not open command.json` | Problema de lectura de archivo |
| `[CMD] ERROR: unknown action '...'` | Acción no reconocida |
| `[CMD] Stopped \| reason: N` | EA detenido |

---

## Parámetros de entrada (MT4 Inputs)

| Parámetro | Defecto | Descripción |
|-----------|---------|-------------|
| `BROKER_NAME` | `"ftmo"` | Nombre identificador del broker, incluido en los logs |

---

## Dependencias

- **No requiere** conexión de red
- **Requiere** que la carpeta `bridge\` exista en `MQL4/Files/`
- **Coordinación** con `HttpBridgeState.mq4` (ambos EAs deben estar activos en el mismo símbolo)

---

## Notas de instalación

1. Copiar `HttpBridgeCommands.mq4` a `MQL4/Experts/`
2. Compilar en MetaEditor
3. Adjuntar al gráfico del símbolo operado (ej. EURUSD M1)
4. Asegurarse de que `Allow live trading` está activado en las propiedades del EA
5. Crear la carpeta `MQL4/Files/bridge/` si no existe
