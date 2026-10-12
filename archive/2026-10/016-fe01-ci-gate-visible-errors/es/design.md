# 016 · FE-01 — Gate de CI y errores visibles · Diseño

> Status: **approved**

## Enfoque

Cinco cambios de frontend y uno de workflow, todos sin cambio de comportamiento en el camino de éxito:

1. **Lint a cero** — corregir los 33 problemas en el código (sin silenciar).
2. **Mutaciones honestas** — cada `fetch` que escribe comprueba `res.ok` y el llamador muestra un único toast de error.
3. **Boundaries** — un boundary de error a nivel de app, un toast en `unhandledrejection` y un tope de reintentos en `ChartErrorBoundary`.
4. **Dos defectos de CSS** — `.label` en las cards pendientes, las clases `*Desktop` sin definir.
5. **Job `check`** en `deploy-frontend.yml`; `deploy` depende de él.

Aún no se comparte nada más allá de un helper mínimo (`errorFrom(res)`) en `lib/api.ts`: FE-03 plegará estos puntos de llamada en `apiFetch`/`sendCommand`. Los toasts siguen usando el store existente `lib/toast.ts`.

## 1. Lint a cero (`[frontend]`)

Los 33 problemas, agrupados por arreglo:

| Regla | Dónde | Arreglo |
|---|---|---|
| `no-useless-escape` ×4 | `LightweightChart.tsx:74`, `position.ts:156` | `[\-]` → poner `-` al final de la clase |
| `no-empty` ×1 | `ws.ts:23` | `catch { /* malformed frame: ignore */ }` con comentario (ESLint acepta un bloque comentado) |
| `react-refresh/only-export-components` ×1 | `AuthContext.tsx:57` | mover `useAuth` a `features/auth/useAuth.ts`; actualizar los 6 importadores |
| `react-hooks/refs` ×5 | `useWs.ts:6`; `LightweightChart.tsx:1028-1031` | `useWs`: asignar la ref dentro de `useEffect(() => { onMessageRef.current = onMessage; })`. Leyenda: `precisionRef.current` leído en render → derivar `const precision = getPricePrecision(symbol)` en render (puro, mismo valor que el efecto guarda en `:676`) |
| `react-hooks/exhaustive-deps` ×4 | `LightweightChart.tsx:644` | copiar `emaSeriesRef.current` a una local al inicio del efecto y usarla en la limpieza |
| | `LightweightChart.tsx:728` | el efecto lee `symbol`/`timeframe` solo a través de refs o no los lee — leer el cuerpo; añadirlos (si se usan) o quitar el uso; **no se puede introducir ningún refetch** (verificar con Network) |
| | `NewTradePanel.tsx:76` | `onClose` a través de un `onCloseRef` mantenido al día en un efecto (mismo patrón que `useWs`) |
| | `NewTradePanel.tsx:128` | depender de `activeMirrorKey = activeMirrorBrokers.join('|')` y de `initialSymbol`; el cuerpo ya filtra por `mode`, así que el número de fetches no cambia |
| `react-hooks/set-state-in-effect` ×18 | ver abajo | tres patrones |

### Los 18 `set-state-in-effect`

La regla señala un `setState` alcanzable de forma síncrona desde el cuerpo de un efecto. Tres patrones cubren los 18:

**(a) "Resetear cuando cambia una prop"** — el patrón documentado por React de *ajustar estado durante el render*:

```ts
const [prevOpen, setPrevOpen] = useState(open);
if (open !== prevOpen) {
  setPrevOpen(open);
  if (!open) { setSl(''); setTp(''); setSubmitting(false); }
}
```

Aplicado a `BulkEditPanel:21`, `ClosePositionPanel:20`, `NewTradePanel:92` (abrir → preseleccionar) y `:162` (cerrar → resetear), `AlertsPanel:45` (broker/símbolo → formulario), y en `ChartPage` a los tres resets por cambio de selección (`:300` `setLiveCandle(null)`, `:320` `setCandles([])`/`setHasMore`/`setChartLoading`, `:345` `setDrawings(null)`) fundidos en **un** bloque con clave `${broker}|${symbol}|${timeframe}`. Mismos renders que hoy (el reset ocurre un render antes, antes de pintar, en vez de después de un commit).

**(b) "Valor inicial desde el entorno"** — inicializadores perezosos de `useState`:

- `usePush:36`: `useState<Status>(() => !isSupported() ? 'unsupported' : Notification.permission === 'denied' ? 'denied' : 'unknown')`; el efecto conserva solo la parte asíncrona de `serviceWorker.ready`.
- `JournalPage:43`: `filters` y `tab` inicializados desde `searchParams` en sus inicializadores; el efecto conserva solo `setSearchParams({}, { replace: true })` (no es un setter de estado React — no se señala), y el `eslint-disable` existente de `:46` se quita si la regla deja de saltar.

**(c) "Solo arrancar trabajo asíncrono"** — efectos cuya parte síncrona pone estado de carga/vacío:

- `ChartPage:203` y `NewTradePanel:101` (`!broker` → `setSymbols([])`, `setSymbol('')`): se resuelven con el patrón (a) sobre `broker`.
- `ClosedPositions:24` (`setLoading(true)`, `setError('')`): patrón (a) con clave en los límites del filtro.
- `NewTradePanel:134` (`setSetup(null)`), `:149` (`setBid(null)`): patrón (a) con clave `open|mode|broker|symbol`.
- `useAlerts:36`, `useEmaAlerts:44` (`useEffect(() => { refresh(); })`): la regla sigue a `refresh` hasta su `setAlerts` síncrono en el camino del catch. Reescribir `refresh` para que todo `setAlerts` quede tras un `await` (`const list = await load(); setAlerts(list)`) — lo que ya hace en el camino de éxito; el camino del catch pasa a `setAlerts([])` tras el rechazo del fetch esperado, igualmente tras un `await`. Si la regla sigue saltando, arrancar la carga con `.then(setAlerts, () => setAlerts([]))` en el efecto.

Los 18 se verifican con el único árbitro que importa: `npm run lint` a 0, más una pasada manual por la UI afectada (abrir/cerrar cada panel, cambiar broker/símbolo/timeframe en el gráfico, deep-link al journal, cambiar el filtro de trades cerrados) comprobando que el comportamiento es idéntico y, en Network, que no se duplica ninguna petición.

## 2. Mutaciones honestas (`[frontend]`)

`lib/api.ts` gana un helper:

```ts
export async function errorFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
  return body.error ?? body.message ?? `Error ${res.status}`;
}
```

| Sitio | Hoy | Cambio |
|---|---|---|
| `ClosePositionPanel.tsx:28-41` | toast "Close sent" siempre | `if (!res.ok) throw new Error(await errorFrom(res))` antes del toast; el `catch` existente muestra el mensaje |
| `OpenPositions.tsx:127-150` `confirmAndClose` | `try/finally`, sin feedback | añadir `if (!res.ok) throw …` y un `catch` → `addToast(msg, 'error')`; en éxito seguir en silencio como hoy (después llega el toast del `command_result` por WS) |
| `BulkEditPanel.tsx:31-48`, `JournalPage.tsx:82-99` | `Promise.all` de fetches, toast de éxito | recoger `const results = await Promise.all(...)`; `const failed = results.filter(r => !r.ok)`; si hay alguno, toast `"${failed.length} of ${n} commands rejected: ${await errorFrom(failed[0])}"` y saltar el toast de éxito; si no, sin cambios |
| `ChartPage.tsx:414-428` modify por arrastre | `.catch(() => {})`, ignora el estado | `.then(async res => { if (!res.ok) addToast(await errorFrom(res), 'error'); }).catch(() => addToast('Network error sending modify', 'error'))` |
| `NewTradePanel.tsx:72-73` | segundo toast de error en `command_result` | quitar el `addToast`; conservar `setSubmitting(false)` (AppLayout ya muestra todo error de `command_result`) |
| `SettingsPage.tsx:56-65` | `setSaved(true)` siempre | `if (!res.ok) { addToast(await errorFrom(res), 'error'); return; }` dentro del `try`; `catch` → toast "Network error"; `setSaved` solo en éxito |
| `useAlerts.ts` / `useEmaAlerts.ts` `create/toggle/remove` | sin `res.ok`, sin catch | `if (!res.ok) throw new Error(await errorFrom(res))`; `refresh()` sigue en `finally` para que la lista refleje el servidor. `AlertsPanel` ya hace `await` de `onCreate`/`onCreateEma` en los handlers: envolver esos y `handleToggle`/`handleDelete`/el `onToggleEma` inline en `try/catch` → `addToast` |
| `ColorBadge.tsx:18` | optimista, sin comprobación | con `!res.ok` o error de red: `onColorChange(broker, ticket, color)` (revertir) + toast |
| `ChartPage.tsx:174` `saveEmas` | sin comprobación | `if (!res.ok) addToast(await errorFrom(res), 'error')`; `catch` → toast |
| `AuthContext.tsx:45-48` `logout` | `setUser(null)` solo tras un 2xx | `try { await fetch(...) } finally { setUser(null); }` |

Sin cambios en los cuerpos de las peticiones ni en los toasts de éxito (AC 3, AC 9).

## 3. Boundaries (`[frontend]`)

- `app/AppErrorBoundary.tsx` — componente de clase (React no tiene hook para `getDerivedStateFromError`), montado en `Router.tsx` **dentro** de `BrowserRouter` alrededor de `<Routes>` para que el fallback se pinte dentro de la app: un panel centrado con los estilos del sistema de diseño ("Something went wrong" · mensaje del error en `--font-mono` · botón `Reload` → `window.location.reload()`), `console.error` del error. `AuthProvider` queda fuera (un error ahí no tiene dónde pintarse).
- `main.tsx` — `window.addEventListener('unhandledrejection', e => { console.error(e.reason); addToast(messageOf(e.reason), 'error'); })` donde `messageOf` lee `Error.message` o cae a "Unexpected error". Un toast por rechazo (AC 6).
- `ChartErrorBoundary.tsx` — añadir `attempts` al estado; `componentDidCatch` programa el auto-reset solo mientras `attempts < MAX_AUTO_RETRIES` (3); más allá, `render` muestra un fallback pequeño (`styles.chartFallback`: "Chart failed to render" + botón `Retry` que pone `attempts` y `failed` a cero). Un cambio de `resetKey` (símbolo/timeframe) resetea ambos. El caso transitorio "Value is null" se sigue recuperando en los primeros frames como hoy (AC 7).

## 4. Defectos de CSS (`[frontend]`)

- `JournalPage.module.css`: añadir `.pendingCardRow .label { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--muted); letter-spacing: var(--tracking-wide); text-transform: uppercase; }` — la misma regla que usa `PositionCard.module.css:160`, para que las cards pendientes coincidan con las de posiciones (AC 8).
- `JournalPage.tsx:139-162`: los spans `*Desktop` no tienen estilo hoy (clase sin definir) y sus hermanos `*Mobile` son `display: none` a cualquier ancho, así que el texto de escritorio es lo que se ve siempre. Quitar los tres `className` sin definir de los spans (los spans se quedan). Cero cambio visual.

## 5. Workflow (`[infra]`)

`.github/workflows/deploy-frontend.yml` gana un job `check` calcado del backend y `deploy` recibe `needs: check`:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
  deploy:
    needs: check
    …(sin cambios)
```

`npm run build` en el runner no necesita `.env.production` (`VITE_API_BASE` solo se lee en runtime, vacío vale) y `__BUILD_FRONTEND__` cae a 0 con un aviso en un checkout superficial — inofensivo, el deploy sigue compilando en el VPS con el historial completo. FE-10 añade `npm test` a este job.

## Flujo de datos

Sin cambios: mismas peticiones, mismos cuerpos, mismos mensajes WS. El único comportamiento de red nuevo es *leer* el cuerpo de error de las respuestas fallidas.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/lib/api.ts` | `errorFrom` |
| `frontend/src/lib/useWs.ts`, `ws.ts`, `useAlerts.ts`, `useEmaAlerts.ts`, `usePush.ts` | arreglos de lint, gestión de errores |
| `frontend/src/features/auth/AuthContext.tsx`, `useAuth.ts` (nuevo) + 6 importadores | `useAuth` movido; `logout` con finally |
| `frontend/src/features/chart/ChartPage.tsx`, `LightweightChart.tsx`, `AlertsPanel.tsx`, `ChartErrorBoundary.tsx`, `ChartErrorBoundary.module.css` (nuevo, o reutilizar `ChartPage.module.css`) | arreglos de lint, gestión de errores, tope de reintentos |
| `frontend/src/features/journal/*.tsx`, `utils/position.ts`, `JournalPage.module.css` | arreglos de lint, gestión de errores, `.label`, `*Desktop` |
| `frontend/src/features/settings/SettingsPage.tsx` | error al guardar |
| `frontend/src/app/AppErrorBoundary.tsx` (nuevo), `AppErrorBoundary.module.css` (nuevo), `Router.tsx`, `main.tsx` | boundary, handler de rechazos |
| `.github/workflows/deploy-frontend.yml` | job `check` |
| `reports/2026-10-08-frontend.md` | columna `Spec` de FE-01 → `016` / `016 ✅` |

## Riesgos

- **Una reescritura de `set-state-in-effect` cambia cuándo ocurre un reset** (un render antes). Mitigado por la pasada manual por panel y por Network mostrando el mismo número de peticiones; la propia regla es el test de regresión del patrón.
- **Los toasts de error sacan a la luz fallos que eran silenciosos** — esperado; son fallos reales.
- **El job `check` retrasa el deploy ~1 min** — aceptable; es lo que ya hace el backend.
- **Mover `useAuth`** toca 6 imports — mecánico, lo detecta `tsc`.

## Alternativas consideradas

- **Silenciar `set-state-in-effect` en los paneles** — excluido explícitamente por el AC 2; la regla señala renders en cascada reales.
- **Introducir `apiFetch` ahora** — haría que esta spec tocara los 50 puntos de llamada; FE-03 lo hace sobre un lint ya en verde.
- **`errorElement` con `createBrowserRouter`** — cambiaría la API del router por un único fallback; un boundary de clase es más pequeño.
- **Ejecutar el check en el VPS en vez de en el runner** — el build del VPS ya corre allí; un lint fallido en el VPS ya habría reseteado y hecho pull del árbol. El gate en el runner se detiene antes de tocar el servidor.
