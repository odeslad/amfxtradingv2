# 012 · BE-06 — Robustez del resultado de comandos · Diseño

## Enfoque

Sacar la parte de ficheros del camino de órdenes de `routes/commands.ts` a `bridge/command-io.ts`: escritura atómica, parseo del resultado, redacción del error, limpieza de resultados obsoletos y la propia espera. Todo ahí recibe rutas y un intervalo de sondeo, así que se testea contra un directorio temporal con timers falsos de vitest — sin EA, sin MT4. La ruta conserva la forma HTTP, la cola por broker y los broadcasts WS; solo llama al módulo nuevo. La espera devuelve o un resultado o un timeout *más una promesa de resultado tardío*, de modo que la cola avanza en el timeout mientras la vigilancia en segundo plano continúa.

Sin dependencias nuevas.

## Cambios por capa

### backend

**1. `src/bridge/command-io.ts` (nuevo)**

```ts
export interface CommandResult { id: string; status: string; ticket?: number; code?: number; message?: string }

export const WAIT_BASE_MS = 10_000;      // como hoy
export const WAIT_PENDING_MS = 30_000;   // cuando pending.json lleva nuestro id
export const WAIT_LATE_MS = 60_000;      // vigilancia en segundo plano tras el timeout
export const POLL_MS = 300;

export function writeCommand(bridgePath: string, command: object): void
// writeFileSync(command.tmp) → renameSync(command.tmp → command.json). Windows: renameSync
// sobre un command.json existente lo reemplaza (el EA lo borra tras leerlo de todos modos).

export function readResult(resultPath: string): CommandResult | null
// null si el fichero falta, no se puede leer o aún no es JSON completo (EA a mitad de escritura).

export function errorText(result: CommandResult): string | undefined
// 'ok' → undefined; message → `EA error: ${message}` + ` (code ${code})` si hay code; si no `EA error (code N)` / 'EA error'.

export function discardStaleResult(resultPath: string, log: (msg: string) => void): void
// existe result.json con cualquier id → unlink + log una vez (`discarding stale result id=…`).

export type WaitOutcome =
  | { kind: 'result'; result: CommandResult }
  | { kind: 'timeout'; late: Promise<CommandResult | null> };

export function waitForResult(opts: { resultPath: string; pendingPath: string; id: string }): Promise<WaitOutcome>
```

`waitForResult` sondea cada `POLL_MS`:
- resultado con nuestro `id` → unlink, resuelve `result`.
- transcurridos ≥ `WAIT_BASE_MS` y `pending.json` **no** lleva nuestro `id` → timeout.
- transcurridos ≥ `WAIT_PENDING_MS` → timeout en cualquier caso.
- en timeout: resuelve `{ kind: 'timeout', late }` donde `late` sigue sondeando `WAIT_LATE_MS` más y resuelve con el resultado (ya borrado) o `null`. Ambas fases comparten un único intervalo que se limpia al final; un resultado con otro id se deja intacto (pertenece al `discardStaleResult` de un comando posterior).

**2. `src/routes/commands.ts`**

```ts
enqueue(broker, async () => {
  discardStaleResult(resultPath, msg => console.warn(`[CMD:${broker}] ${msg}`));
  try { writeCommand(brokerConfig.bridgePath, command); } catch … (como hoy)
  const outcome = await waitForResult({ resultPath, pendingPath, id });
  if (outcome.kind === 'result') { broadcastResult(outcome.result); return; }
  broadcaster?.(id, 'timeout', undefined, 'No response from EA');
  console.warn(`[CMD:${broker}] timeout waiting for result id=${id}`);
  void outcome.late.then(result => {
    if (!result) return;
    console.log(`[CMD:${broker}] late result id=${id} status=${result.status} ticket=${result.ticket ?? '-'}`);
    broadcaster?.(id, result.status, result.ticket, errorText(result), true);
  });
});
```

`Broadcaster` gana un quinto argumento opcional `late?: boolean`; `broadcastCommandResult` en `ws.ts` añade `late: true` a la carga solo cuando se indica (la forma del mensaje no cambia en el resto). El cableado de `index.ts` lo pasa.

**3. Tests — `src/bridge/command-io.test.ts`** (directorio temporal por test vía `fs.mkdtempSync`, `vi.useFakeTimers` para el sondeo)

- `writeCommand`: existe `command.json` con el JSON, no queda `command.tmp`; sobrescribe un `command.json` existente.
- `readResult`: falta → null; JSON parcial → null; completo → parseado.
- `errorText`: ok → undefined; `{status:'error',code:130}` → `EA error (code 130)`; `{message:'ticket not found'}` → `EA error: ticket not found`; ambos → `EA error: ticket not found (code 130)`; ninguno → `EA error`.
- `discardStaleResult`: borra y registra una vez; sin fichero → sin log.
- `waitForResult`: resultado a los 2 s → `result`, fichero borrado; nada a los 10 s → timeout, `late` resuelve null a los 70 s; `pending.json` con nuestro id → sigue esperando a los 15 s, resultado a los 20 s → `result`; `pending.json` con nuestro id pero sin resultado → timeout a los 30 s; resultado a los 25 s tras un timeout a los 10 s → `late` resuelve con él y el fichero se borra; `result.json` con otro id → ignorado (timeout), fichero intacto.

**4. `docs/architecture.md` / `ea/docs/HttpBridgeCommands.md`**: anotar la espera extendida y la marca `late` en el mensaje WS (doc del backend); la doc del EA ya describe `pending.json` — añadir una línea de que el backend ahora lo respeta.

## Flujo de datos

Sin cambios salvo los tiempos: `POST /commands` → 202 → cola → `command.tmp`→`command.json` → EA → (`pending.json`) → `result.json` → `command_result` (inmediato, o `timeout` y después posiblemente un segundo `command_result` con `late: true`).

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/src/bridge/command-io.ts` | nuevo |
| `backend/src/bridge/command-io.test.ts` | nuevo |
| `backend/src/routes/commands.ts` | usar el módulo; gestión del resultado tardío; `waitForResult` sale de aquí |
| `backend/src/ws/ws.ts` | `broadcastCommandResult(..., late?)` |
| `backend/src/index.ts` | pasar `late` por el broadcaster |
| `backend/docs/architecture.md`, `ea/docs/HttpBridgeCommands.md` | notas de espera/tardío (solo docs; el cambio en la doc del EA es un commit `docs(ea)`) |

## Riesgos

- **Rename sobre un fichero existente en Windows**: `fs.renameSync` reemplaza el destino en Windows (semántica MoveFileEx en libuv). Si el EA tiene `command.json` abierto en ese instante el rename falla con `EPERM`; la escritura está dentro del try/catch existente y reporta `Failed to write command` — el mismo modo de fallo que el `writeFileSync` de hoy sobre un fichero abierto, no uno nuevo.
- **`ok` tardío tras repetir la orden**: el usuario puede haber repetido la orden durante la ventana del timeout; el toast tardío le dice que se ejecutaron dos. Es justo la información que le faltaba; la espera de 30 s consciente de pending reduce mucho esa ventana.
- La vigilancia en segundo plano nunca bloquea la cola; como mucho un intervalo de 300 ms por vigilancia tardía, acotado a 60 s.
- La validación en producción necesita una ejecución lenta real: el usuario enviará un `modify` con ticket inválido (`EA error: ticket not found` inmediato) y una orden normal; el camino tardío lo prueban los tests unitarios y, en producción, parar el EA ~15 s antes de enviar un comando (sin `pending.json` → timeout a los 10 s, EA reiniciado → el resultado llega tarde → toast "Order executed").
