# 017 · FE-02 — Cancelación de respuestas obsoletas · Diseño

## Enfoque

Un único patrón, aplicado a mano en cada punto, sin más abstracción que un helper de dos líneas:

```ts
useEffect(() => {
  const ac = new AbortController();
  fetch(url, { credentials: 'include', signal: ac.signal })
    .then(…)
    .catch(err => { if (!isAbortError(err)) …; });
  return () => ac.abort();
}, [deps]);
```

- Se prefiere `AbortController` a una bandera `cancelled` porque además libera la conexión y detiene la descarga del cuerpo; ambos cumplen los criterios de aceptación.
- Una petición abortada es **silenciosa**: el cleanup corre porque cambiaron las entradas (el reset en render ya ha puesto el nuevo estado de carga) o porque el componente se desmontó, así que el `catch` no debe tocar estado. `isAbortError(err)` va a `lib/api.ts` junto a `errorFrom`/`errorMessage`:

```ts
export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';
```

- Donde la petición no está ligada a un efecto (load-more, `run` del scanner), el controller vive en un `useRef` y el anterior se aborta antes de lanzar la siguiente; un cambio de dependencias o el desmontaje abortan la pendiente.

FE-03 sustituirá después estos `fetch` por `apiFetch<T>(path, { signal })`; las señales se quedan donde las deja esta spec.

## Cambios por archivo

### `features/chart/ChartPage.tsx`

**Efecto de velas** (`:347-368`). Añadir el controller. El éxito no cambia. `catch`: `if (!isAbortError(err)) setChartLoading(false)`; al abortar, el reset en render (`:318-324`) ya ha puesto `chartLoading` para la nueva selección y la respuesta del nuevo efecto lo apagará.

**Efecto de dibujos** (`:370-377`). Añadir el controller; `catch`: `if (!isAbortError(err)) setDrawings([])`. Sin la respuesta obsoleta, `drawings` se queda en `null` hasta que llega la correcta, así que `initialDrawings` nunca lleva los items de un símbolo anterior y `saveDrawings` no puede persistirlos bajo el nuevo (AC 2).

**Efecto de símbolos** (`:215-225`). Añadir el controller y sustituir la guarda `initSymbol` por una actualización funcional que conserva el símbolo actual cuando el nuevo broker lo lista (AC 5):

```ts
setSymbol(prev => list.includes(prev) ? prev : list.includes('EURUSD') ? 'EURUSD' : list[0] ?? '');
```

El efecto pasa a depender solo de `broker` y desaparece el `eslint-disable` de `:224`. Efecto colateral a tener en cuenta: en el primer montaje, un símbolo guardado o de deep-link que el broker no lista ahora se sustituye en lugar de dejar el gráfico vacío.

**Efecto de posiciones del gráfico** (`:332-345`). Añadir el controller; el `catch` sigue siendo `() => {}` (ya silencioso): el aborto solo impide que corra el `.then` (AC 6).

**Load-more** (`:395-416`). Guardar el controller en `loadMoreAcRef`. `loadMoreCandles` lo crea y pasa su señal; el cleanup del efecto de velas (que corre en cada cambio de selección y al desmontar) llama a `loadMoreAcRef.current?.abort()`. Un load-more que termina tras un cambio de selección rechaza con `AbortError` y se descarta (AC 3); el `finally` existente libera `isLoadingMoreRef` en todos los casos.

### `features/chart/LightweightChart.tsx`

Eliminar el `isLoadingMoreRef` propio del componente (`:230`, `:614-618`, `:714`). Duplica la guarda de `ChartPage` (`loadMoreCandles` retorna de forma síncrona cuando hay una petición en vuelo) y es el que se queda pegado: solo se libera cuando se anteponen velas nuevas, así que una página vacía o una petición fallida congelan el scroll infinito hasta remontar. `subscribeVisibleLogicalRangeChange` sigue llamando a `onLoadMoreRef.current()` cuando `range.from <= 30`; la guarda de la página absorbe la ráfaga de eventos de rango durante un scroll (AC 4). Cuando `hasMore` pasa a false, `onLoadMore` es `undefined` y no se dispara nada.

*Alternativa considerada:* que `onLoadMore` devuelva `Promise<void>` y liberar el ref del gráfico en su `finally`. Descartada: dos guardas para una petición, y el gráfico tendría que manejar una prop que puede ser síncrona o asíncrona.

### `features/journal/OpenPositions.tsx` (`:57-77`)

Añadir el controller (abortado al desmontar). Para que el snapshot REST no pise un mensaje del WebSocket que llegó antes (AC 7), registrar los brokers ya refrescados por el WS en `wsBrokersRef: useRef(new Set<string>())` (`handleWsMessage` añade `msg.broker`) y aplicar el snapshot por broker, saltando los del conjunto:

```ts
const fresh = all.filter(p => !wsBrokersRef.current.has(p.broker!));
if (fresh.length > 0) setPositions(prev => [...prev, ...fresh].sort(byBrokerThenTime));
```

El snapshot corre una vez al montar, así que en ese momento `prev` solo contiene posiciones entregadas por el WS; añadir los brokers que el WS aún no ha refrescado no puede duplicar nada. El mapa de colores se aplica igual (solo para brokers aún no refrescados por el WS). El comparador de orden se extrae a un `byBrokerThenTime` local porque ya está duplicado entre el snapshot y el handler del WS.

### `features/journal/ClosedPositions.tsx` (`:32-44`)

Añadir el controller:

```ts
.then(setTrades)
.catch(err => { if (isAbortError(err)) return; setError(err.message); })
.finally(() => { if (!ac.signal.aborted) setLoading(false); });
```

El reset en render (`:27-31`) ya pone `loading = true` para el nuevo rango, así que una petición abortada no debe apagarlo (AC 8).

### `lib/useScanner.ts` (`:43-60`)

`run` pasa a:

```ts
const acRef = useRef<AbortController | null>(null);
const run = useCallback(async (params) => {
  if (!params.broker) return;
  acRef.current?.abort();
  const ac = new AbortController();
  acRef.current = ac;
  setLoading(true);
  try {
    const res = await fetch(url, { credentials: 'include', signal: ac.signal });
    if (ac.signal.aborted) return;
    setResult(res.ok ? await res.json() : EMPTY);
  } catch (err) {
    if (!isAbortError(err)) setResult(EMPTY);
  } finally {
    if (acRef.current === ac) setLoading(false);
  }
}, []);
useEffect(() => () => acRef.current?.abort(), []);
```

Solo la última ejecución escribe `result` y apaga `loading` (AC 9). El cleanup de desmontaje aborta una ejecución en vuelo al salir de la página.

### `lib/api.ts`

Añadir `isAbortError`.

## Flujo de datos

Solo frontend; ningún endpoint del backend, mensaje WS ni bridge del EA cambia. El contrato EA ↔ backend queda intacto.

## Riesgos

- **Dibujos guardados antes de que termine la carga.** Preexistente: si el usuario dibuja en un símbolo antes de que vuelva su `GET /drawings`, el PUT lleva solo el dibujo nuevo. Esta spec elimina la vía de la carga obsoleta (la que corrompe) y no cambia esa carrera; queda anotada para FE-03/FE-05. La verificación de AC 2 compara `GET /drawings` de ambos símbolos antes y después de la prueba para demostrar que no se perdió nada.
- **Quitar la guarda de load-more del gráfico.** `loadMoreCandles` puede llamarse ahora muchas veces por scroll; cada llamada es un retorno síncrono temprano mientras hay petición pendiente, sin coste. Se verifica haciendo scroll al borde izquierdo repetidamente con la pestaña Network abierta: una petición `before=` por página.
- **Re-elección de símbolo al montar.** Un deep-link con un símbolo que el broker no lista aterriza ahora en EURUSD o el primer símbolo en vez de en un gráfico vacío; la URL la reescribe el efecto de persistencia de selección existente. Intencionado, pero visible.
- **Forma del AbortError.** En navegadores un `fetch` abortado rechaza con una `DOMException` de nombre `AbortError`; `isAbortError` comprueba ambas cosas para que un futuro entorno de test que lance un `Error` plano no se trague silenciosamente como fallo real.

## Verificación

- `npx eslint .` y `npm run build` en `frontend/` (AC 11).
- Throttling de red "Slow 3G" en DevTools: cambiar de símbolo tres veces seguidas; gráfico, dibujos y leyenda son los del último; `GET /drawings` de los símbolos anteriores sin cambios (AC 1, AC 2).
- Hacer scroll hasta la vela más antigua hasta que `before=` devuelva `[]`, cambiar de timeframe y volver a hacer scroll a la izquierda: las peticiones de load-more se reanudan (AC 4). Bloquear `/candles?…before=` en DevTools, scroll a la izquierda, desbloquear, scroll a la izquierda: se lanza una nueva petición (AC 4).
- Cambiar a un broker sin el símbolo actual: el gráfico muestra EURUSD o el primer símbolo; cambiar a uno que lo lista: el símbolo se conserva (AC 5).
- Journal con throttling: cambiar el rango de fechas dos veces rápido; la tabla muestra el último rango y el spinner se apaga una sola vez (AC 8). Scanner: editar los números de EMA rápido; un solo resultado y `loading` termina con la última ejecución (AC 9).
