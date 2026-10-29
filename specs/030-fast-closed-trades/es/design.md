# 030 — Reflejo rápido de los trades cerrados · Diseño

## Enfoque

Acortar cada salto del camino de un trade cerrado y añadir un aviso al final:

```
EA (cambia el historial → escribe history.json, ≥3 s entre escrituras)
  → bridge/history.json
  → FileWatcher (5 s, salta contenido sin cambios) → syncTrades / syncBalanceOperations
  → broadcast WS { type: "trades_updated", broker }
  → Stats / Historial vuelven a pedir datos (con debounce)
```

## Cambios por capa

### EA — `ea/HttpBridgeState.mq4`
- Nuevas globales `int g_lastHistoryTotal = -1` y `ulong lastHistoryWrite = 0`.
- Nuevo input `HISTORY_MIN_GAP_S = 3`.
- En el bucle del timer, tras el bloque de cuenta y antes del bloque de estado: si `OrdersHistoryTotal() != g_lastHistoryTotal` y `now - lastHistoryWrite >= HISTORY_MIN_GAP_S * 1000`, llama a `WriteHistory()`, guarda el total y la hora y registra `[STATE] History changed`.
- El bloque de estado sigue llamando a `WriteHistory()` cada 60 s (y actualiza `lastHistoryWrite` / `g_lastHistoryTotal`), así que una detección perdida la cubre el ciclo normal (CA 2).
- `OrdersHistoryTotal()` cuenta lo que muestra la pestaña de historial del terminal: la misma fuente que ya usa `WriteHistory()`, sin limitación nueva.
- Sin cambios en el formato de `history.json`: el contrato de ficheros EA ↔ backend no cambia.

### Backend
- `bridge/file-watcher.ts`
  - Intervalo por defecto `30_000` → `5_000` (CA 3).
  - `history.json` y `account.json` reciben el mismo salto que las velas: primero por `mtime`/tamaño y luego por **contenido** (el último texto leído de cada fichero). El EA reescribe los dos cada 60 s con contenido casi siempre idéntico, así que la comparación de contenido evita que una reescritura sin trades nuevos toque la BD o dispare `trades_updated`. Hoy los dos ficheros se reescriben en BD en cada vuelta; esto quita esa carga.
  - La marca/contenido se recuerda solo si el handler termina bien, así que un fallo de BD se reintenta en la siguiente vuelta (misma regla que las velas).
- `index.ts`: tras `syncTrades` + `syncBalanceOperations` correctos, `if (features.wsBroadcast) wss.broadcastTradesUpdated(brokerName)`.
- `ws/ws.ts`: `broadcastTradesUpdated(broker)` → `broadcast('trades_updated', { broker })` (CA 4, CA 7). Mensaje aditivo.
- Tests: `file-watcher` — un historial sin cambios no se pasa dos veces; con contenido distinto sí; un handler que falla se reintenta.

### Frontend
- `features/stats/StatsPage.tsx`: un contador `refreshKey` en las dependencias del efecto de carga. `useWs` escucha `trades_updated` y, si el `broker` coincide con el seleccionado, sube el contador tras un debounce de 1 s. El `requestKey` no incluye `refreshKey`, así que el resultado actual sigue en pantalla hasta que llega el nuevo: sin parpadeo de carga (CA 5).
- `features/journal/ClosedPositions.tsx`: el mismo contador en su efecto de `/trades`, sin activar `loading` en un refresco (solo un cambio de rango muestra el loader). Pide todos los brokers, así que cualquier `trades_updated` lo dispara.
- Un hook compartido pequeño `lib/useTradesUpdated.ts` (`useTradesUpdated(onUpdate, broker?)`) concentra el filtro WS + debounce para no duplicarlo en las dos páginas.

## Maqueta
No aplica: ninguna pantalla, panel ni estado cambia visualmente; las páginas solo refrescan sus datos actuales.

## Flujo de datos / contrato
- EA ↔ backend: sin cambios (el mismo fichero, escrito más a menudo).
- Backend ↔ frontend: mensaje WS nuevo `{ type: "trades_updated", broker }`; los existentes no cambian.

## Alternativas consideradas
- **Detectar el cierre en el backend desde las posiciones del pipe** (desaparece un ticket) y leer `history.json` al momento: sin tocar el EA, pero el EA aún no ha escrito el trade cerrado, así que seguiría esperando al ciclo de 60 s. Descartada.
- **Enviar los trades cerrados por el pipe**: lo más rápido, pero un mensaje de pipe nuevo y una segunda vía de persistencia de trades. Desproporcionado para ganar unos segundos.

## Archivos
- `ea/HttpBridgeState.mq4`
- `backend/src/bridge/file-watcher.ts`, `backend/src/bridge/file-watcher.test.ts` (nuevo o ampliado), `backend/src/index.ts`, `backend/src/ws/ws.ts`
- `frontend/src/lib/useTradesUpdated.ts` (nuevo), `frontend/src/features/stats/StatsPage.tsx`, `frontend/src/features/journal/ClosedPositions.tsx`
- `.claude/CLAUDE.md` + `backend/docs/architecture.md`: intervalo del watcher y el mensaje WS nuevo.

## Riesgos
- **Despliegue del EA**: hay que recargar los terminales MT4, solo vía AMFX-Watchdog, nunca desde SSH. Backend + frontend salen primero y ya ayudan (watcher a 5 s, refresco automático); el EA puede ir después.
- **Ráfagas de cierres**: el margen de 3 s limita las escrituras del EA; el watcher hace upsert, así que escrituras repetidas no hacen daño.
- **Lectura de un fichero a medio escribir**: el EA podría estar escribiendo mientras el watcher lee; ya pasa hoy: el error de parseo se registra y la siguiente vuelta reintenta.
