# 041 — Suscripción de ticks por WebSocket · Diseño

> Status: **closed**

## Enfoque

El WebSocket pasa a ser bidireccional para un único mensaje: el cliente envía `subscribe` con los pares broker/símbolo que necesita, el backend guarda ese conjunto por cliente y filtra cada lote de ticks contra él antes de enviarlo. Todo lo demás (handshake, heartbeat, backpressure, el resto de tipos de mensaje) se queda como está.

El frontend centraliza el conjunto en `lib/ws.ts`: los componentes declaran el par que necesitan mediante un hook, el módulo mantiene la unión con contador de referencias y la envía cuando cambia y en cada (re)conexión. Los componentes siguen leyendo los mensajes `ticks` exactamente como hoy, así que el filtrado les resulta invisible.

Sin cambio visual: esta spec no lleva maqueta.

## Protocolo

Cliente → servidor, el único mensaje entrante:

```json
{ "type": "subscribe", "ticks": [ { "broker": "solidary III", "symbol": "EURUSD" } ] }
```

- Sustitución completa: la lista es todo el conjunto; `[]` detiene los ticks.
- Límites: como máximo 16 pares; `broker` y `symbol` cadenas no vacías de hasta 64 caracteres; el frame hasta 4 KiB (`maxPayload` del servidor `ws`). Cualquier otra cosa se ignora y se mantiene el conjunto anterior (AC 6).
- Sin confirmación: el siguiente lote coincidente es la confirmación.

Servidor → cliente, misma forma que hoy:

```json
{ "type": "ticks", "broker": "solidary III", "ticks": [ ...solo símbolos suscritos de ese broker... ] }
```

## Cambios en backend (`backend/src/ws/`)

**`policy.ts`**
- `parseSubscription(raw: unknown): Set<string> | null` — valida el mensaje y devuelve el conjunto de claves `broker|symbol`, o `null` cuando no es un `subscribe` válido (pura, con test unitario).
- Constantes `SUBSCRIBE_MAX_PAIRS = 16`, `SUBSCRIBE_MAX_PAYLOAD = 4096`.

**`ws.ts`**
- `Client` gana `tickKeys: Set<string>` (vacío al conectar, AC 1).
- `WebSocketServer({ noServer: true, maxPayload: SUBSCRIBE_MAX_PAYLOAD })`. `ws` cierra con 1009 al cliente que supere `maxPayload`; un cliente que envíe muchos frames pequeños válidos cuesta un `JSON.parse` por frame, lo bastante barato como para no necesitar otro límite (el `sendDecision` existente sigue gestionando a los lectores lentos).
- `ws.on('message')`: `parseSubscription` → sustituye `client.tickKeys` o ignora.
- `broadcastTicks(broker, batch)`: para cada cliente con conjunto no vacío, filtra `batch` a los ticks cuyo `broker|symbol` esté en el conjunto; salta al cliente si el lote filtrado queda vacío; si no, `send`. Los mensajes se codifican una vez por lote filtrado distinto (un pequeño `Map<string, string>` con clave la lista de símbolos unida, construido por emisión), de modo que N clientes en el mismo chart cuestan un solo `JSON.stringify`.
- El resto de funciones `broadcast*` no miran `tickKeys` (AC 8).

**Tests (`ws.test.ts`)**
- El actual "broadcasts ticks to every client" pasa a: sin ticks antes de suscribirse; cada cliente recibe solo sus pares; un lote sin coincidencia no se envía; una suscripción vacía detiene los ticks; un frame mal formado mantiene el conjunto anterior; las alertas siguen por dueño.
- `policy.test.ts` (nuevo o ampliado): `parseSubscription` con válido, demasiados pares, tipos incorrectos, `type` desconocido.

**Docs**: la sección WebSocket de `backend/docs/architecture.md` y la línea WS de `.claude/CLAUDE.md` incorporan el mensaje `subscribe` y la regla "sin ticks hasta suscribirse".

## Cambios en frontend (`frontend/src/`)

**`lib/ws.ts`**
- `const tickRefs = new Map<string, number>()` — clave `broker|symbol`, valor contador de referencias.
- `addTickSubscription(broker, symbol)` / `removeTickSubscription(broker, symbol)` actualizan el mapa y programan `flushSubscription()` en una microtarea (varios componentes cambiando en el mismo render producen un solo frame).
- `flushSubscription()` envía `{ type: 'subscribe', ticks: [...] }` cuando el socket está abierto y el conjunto serializado difiere del último enviado.
- `socket.onopen` llama a `flushSubscription()` con `lastSent = null`, así cada reconexión reenvía el conjunto actual (AC 5).

**`lib/useTickSubscription.ts`** (nuevo)
```ts
export function useTickSubscription(broker: string, symbol: string): void
```
`useEffect` sobre `[broker, symbol]`: añade cuando ambos no están vacíos, quita en el cleanup. Declaración pura, sin valor de retorno.

**Consumidores**
- `features/chart/ChartSlot.tsx`: `useTickSubscription(broker, symbol)` — una llamada por slot, así la vista dividida suscribe los dos pares (AC 4).
- `features/chart/ChartPage.tsx`: el precio del panel de alertas usa el mismo par que el chart; lo declara también para que el panel siga funcionando si algún día los slots cambian de forma independiente. El contador de referencias colapsa el duplicado.
- `features/journal/NewTradePanel.tsx`: `useTickSubscription(open ? levelsBroker : '', open ? symbol : '')` — suscrito solo mientras el panel está abierto, liberado al cerrar.

Nada más cambia: los listeners de `useWs` siguen recibiendo mensajes `ticks` y filtrando por broker/símbolo como hoy, lo que además cubre los pocos lotes de la selección anterior que puedan llegar entre un cambio de selección y la entrada en vigor de la nueva suscripción.

## Flujo de datos

```
EA ──pipe──▶ PipeReader ──'ticks'──▶ index.ts ──▶ wss.broadcastTicks(broker, batch)
                                                        │ por cliente: filtro por tickKeys
                                                        ▼
Frontend lib/ws.ts ◀──{type:'ticks', broker, ticks:[subconjunto]}──┘
        ▲
        └──{type:'subscribe', ticks:[{broker,symbol}...]}── al cambiar / al abrir
             ▲
   useTickSubscription() en ChartSlot · ChartPage · NewTradePanel
```

## Ficheros a tocar

| Capa | Fichero | Cambio |
|---|---|---|
| backend | `src/ws/policy.ts` | `parseSubscription`, límites |
| backend | `src/ws/ws.ts` | `tickKeys` por cliente, `maxPayload`, handler entrante, `broadcastTicks` filtrado |
| backend | `src/ws/ws.test.ts`, `src/ws/policy.test.ts` | tests de suscripción |
| backend | `docs/architecture.md` | sección WebSocket |
| frontend | `src/lib/ws.ts` | registro de suscripciones + frame `subscribe` |
| frontend | `src/lib/useTickSubscription.ts` | hook nuevo |
| frontend | `src/features/chart/ChartSlot.tsx`, `ChartPage.tsx`, `src/features/journal/NewTradePanel.tsx` | declaran su par |
| — | `.claude/CLAUDE.md` | línea WS |

Sin cambio de BD, sin dependencias nuevas.

## Verificación del AC 7

El script de medición usado el 2026-11-10 (se conecta a `ws://localhost:3000/ws` en el VPS con un token firmado y cuenta bytes durante 60 s) se conserva en `backend/scripts/ws-measure.js` y gana un argumento opcional `--subscribe broker:symbol`. Se ejecuta dos veces tras el deploy del backend: sin suscripción (se esperan ≈ 0 B de ticks) y con un par (se espera bastante menos de 16 KB/s con actividad de mercado similar). Los dos números van a `verification.md`.

## Riesgos

- **Frontend antiguo en caché tras el deploy del backend**: nunca se suscribe, así que sus charts dejan de actualizarse en vivo hasta que el usuario recarga (el AC 9 lo acepta; el service worker de la PWA puede servir el bundle antiguo una visita más). Desplegar el frontend justo después del backend para acortar esa ventana.
- **Carrera al cambiar de selección**: entre que el `subscribe` sale del navegador y el backend lo aplica, pueden llegar unos lotes del par anterior; los chequeos de broker/símbolo que ya hace cada componente los descartan. A la inversa, puede pasar hasta un intervalo de tick (100 ms) antes del primer tick del nuevo par: invisible junto a la carga REST de velas que corre a la vez.
- **Interacción con backpressure**: un lote filtrado es más pequeño, así que `bufferedAmount` crece más despacio; los umbrales de `sendDecision` se quedan como están.

## Alternativas consideradas

- **Enviar todo a los clientes que nunca se suscriben** (compatible hacia atrás): mantiene funcionando los bundles antiguos pero anula el ahorro para cualquier cliente que no llegue a suscribirse, y esconde bugs. Rechazada por los requisitos (AC 1).
- **Suscribir solo por broker**: frame más simple, pero un broker con 7 símbolos sigue enviando 7 veces lo que el chart necesita. Rechazada; la granularidad por par no cuesta nada extra.
- **Query string en el upgrade** (`/ws?broker=…&symbol=…`): no haría falta mensaje entrante, pero cada cambio de selección reconectaría. Rechazada.
