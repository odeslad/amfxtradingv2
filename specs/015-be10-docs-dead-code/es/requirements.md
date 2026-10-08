# 015 · BE-10 — Documentación del backend y código muerto

> Status: **approved**
> Origin: [auditoría de backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 10 (diagnóstico G)

## Contexto

Los dos documentos que describen el backend están desactualizados, y parte del código sobrevive solo porque nadie lo borra:

- `.claude/CLAUDE.md` se carga en cada sesión de Claude. Su sección "Arquitectura del backend" aún describe `positions.json` / `syncPositions`, un modelo `Position`, un campo `magic` y dos tipos de mensaje de pipe (hay tres: ticks, positions, account); las secciones "Trading Engine" y "Diseño del sistema de estrategias" (~250 líneas) y la tabla "Pendiente backend" describen un engine eliminado en la spec 001. El usuario ha decidido **mover** el material del engine y las estrategias a `epics/trading-engine/concept.md` en lugar de borrarlo.
- `backend/docs/architecture.md` cita archivos que no existen (`ws/ticks.ts`, `services/positions.ts`), variables de entorno que no se leen (`BRIDGE_PATH`, `BROKER_NAME`), el nombre de pipe de un solo broker, una ruta `/ws/ticks`, una tabla `positions` y una tabla `account_snapshots`. Las specs 010 y 012 mantuvieron al día sus secciones `/health` y `POST /commands`; el resto es de la primera semana del proyecto.
- `backend/.env.example` lista cuatro variables; el backend también lee `JWT_SECRET` (obligatoria), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`, los flags `FEATURE_*` y ajustes tipo `ALLOWED_ORIGINS`. Un checkout nuevo no se puede configurar solo con el ejemplo.
- `indicators/ema-cross.ts` sigue calculando pivotes y la clasificación de velas weak/strong, y conserva los tipos `WeakConfig` / `StrongConfig` / `PivotPoint` del engine eliminado. Sus dos consumidores (`services/scanner.ts`, `routes/setup-levels.ts`) nunca leen esos campos, así que ~130 líneas se ejecutan en cada llamada del scanner y se descartan. La auditoría también señaló exports sin lector (`store/positionColors.ts` `getColorsByBroker`, `services/push.ts` `isPushEnabled`) y un comentario obsoleto en `index.ts:1`.

## Capas afectadas

- backend (código y `docs/`)
- documentación del repo (`.claude/CLAUDE.md`, `epics/`) — sin código de capa

Sin cambios en frontend, db, EA ni infra. Las respuestas HTTP de `/scanner` y `/setup-levels` no cambian.

## Historias de usuario

- Como usuario, quiero que `CLAUDE.md` describa el backend que existe, para que cada sesión arranque desde hechos y no desde un diseño eliminado.
- Como usuario, quiero conservar el diseño del engine y las estrategias como epic, para poder partirlo en specs cuando toque sin rebuscar en el historial de git.
- Como desarrollador, quiero que `architecture.md` y `.env.example` basten para arrancar el backend desde un checkout nuevo.
- Como usuario, quiero que el scanner calcule solo lo que devuelve, para que no sea más lento de lo necesario y el archivo se lea como la funcionalidad a la que sirve.

## Criterios de aceptación

- AC 1. `.claude/CLAUDE.md` no tiene sección "Trading Engine", "Diseño del sistema de estrategias" ni "Pendiente backend"; su sección de backend describe los tres tipos de mensaje del pipe, el file watcher (account, history, candles — sin positions), los tipos de mensaje del WebSocket `/ws`, el bridge de comandos (con `pending.json` y resultados tardíos), las alertas, los stores, el multi-broker, `/health` y los modelos de BD que existen (`Candle`, `Trade`, `Balance`, `BalanceOperation`, settings, users, alertas, drawings, push). Nada de lo que afirma contradice el código.
- AC 2. `epics/trading-engine/concept.md` contiene el material del engine y las estrategias movido literalmente (encabezados, tablas, bloques JSON) con una cabecera breve que diga de dónde viene, cuándo, y que nada de ello está implementado.
- AC 3. `backend/docs/architecture.md` coincide con el código: árbol real de `src/`, variables de entorno que realmente se leen (nombre, obligatoria/opcional, default), patrón de nombre del pipe por broker, ruta `/ws` y tipos de mensaje, tablas de BD existentes con su patrón de escritura, secciones `/health` y `POST /commands` existentes conservadas. Toda ruta que nombra existe.
- AC 4. `backend/.env.example` lista todas las variables que el backend lee, con un comentario en cada una: propósito, obligatoria u opcional, default. Los secretos llevan placeholders, nunca valores reales.
- AC 5. `indicators/ema-cross.ts` ya no calcula pivotes ni velas weak/strong y ya no exporta `WeakConfig`, `StrongConfig`, `PivotPoint`; `EmaCrossSetup` conserva solo los campos que un consumidor lee más los niveles. `detectEmaCrossSetups` devuelve los mismos setups (dirección, índices, tiempos, precios, niveles, MAE/MFE) que antes para la misma entrada.
- AC 6. CUANDO se llama a `/scanner` y `/setup-levels` con los mismos parámetros antes y después del cambio ENTONCES sus respuestas JSON son idénticas byte a byte (referencia capturada contra datos de producción antes del cambio).
- AC 7. Los exports sin lector en `backend/src` se eliminan (`getColorsByBroker`, `isPushEnabled`, cualquier otro que encuentre la búsqueda); el comentario obsoleto de `index.ts:1` desaparece. `npm run lint && npm run typecheck && npm test && npm run build` siguen en verde; los tests de `ema-cross` se adaptan a la forma podada y siguen cubriendo los casos de cruce, niveles y dirección.
- AC 8. Sin cambio de comportamiento en el backend desplegado: forma de `/health`, mensajes del WebSocket y todas las rutas responden como antes.

## Fuera de alcance

- Reescribir la documentación del EA o del frontend.
- Cambiar lo que devuelven `/scanner` o `/setup-levels` (solo lo que calculan).
- El cálculo de EMAs propio del frontend.
- Las secciones de sistema de diseño y workflow de `.claude/CLAUDE.md` (sin cambios).
- Los archivos de memoria que Claude guarda fuera del repo (Claude los actualiza al cerrar; no forman parte de los commits de la spec).
