# 016 · FE-01 — Gate de CI y errores visibles

> Status: **approved**
> Origin: [auditoría de frontend 2026-10-08](../../../reports/2026-10-08-frontend.md), mejora 1 (diagnósticos A, B)

## Contexto

Nada comprueba el frontend antes de que llegue a producción: `deploy-frontend.yml` no tiene job de checks (el workflow del backend ejecuta lint, typecheck y tests antes de su deploy), así que el único gate es el `tsc -b` que va dentro de `npm run build` en el VPS. `npx eslint .` falla hoy con 29 errores y 4 avisos (`react-hooks/set-state-in-effect` ×18, `react-hooks/refs` ×5, `exhaustive-deps` ×4, `no-useless-escape` ×4, `no-empty` ×1, `react-refresh/only-export-components` ×1) porque nadie lo ejecuta.

Dentro de la app, los fallos se informan como éxitos o no se informan: cerrar una posición desde el gráfico muestra "Close sent" sea cual sea el estado HTTP (`ClosePositionPanel.tsx:28-41`); cerrar desde el journal no da feedback (`OpenPositions.tsx:127-150`); la edición en bloque y el cierre del journal muestran éxito sin comprobar `res.ok` (`BulkEditPanel.tsx:31-48`, `JournalPage.tsx:82-99`); Settings marca "Saved" tras un PUT fallido (`SettingsPage.tsx:56-65`); crear/activar/borrar alertas, `ColorBadge`, `saveEmas` y `logout` no tienen `catch` o no miran `res.ok`; un New Trade fallido muestra dos toasts de error (`AppLayout.tsx:30-33` y `NewTradePanel.tsx:72-73`). No hay boundary de error a nivel de app (un error de render fuera del gráfico deja la pantalla en blanco) y `ChartErrorBoundary` se resetea al siguiente frame, así que un error persistente del gráfico se convierte en un bucle montar/romper. Dos defectos visibles pequeños: las cards de órdenes pendientes usan `styles.label`, una clase que no existe en `JournalPage.module.css` (`OpenPositions.tsx:319-323`), y `.btnDesktop` / `.filtersBtnDesktop` / `.newTradeBtnDesktop` se usan en `JournalPage.tsx:139-162` pero no están definidas.

Esta spec no introduce la capa compartida `apiFetch` / `sendCommand` (FE-03) ni la cancelación de peticiones (FE-02): hace honestos los puntos de llamada existentes y pone un gate delante del deploy.

## Capas afectadas

- frontend
- infra (`.github/workflows/deploy-frontend.yml`)

Sin cambios en backend, db ni EA. Sin dependencias nuevas: Vitest y el paso `test` del gate pertenecen a FE-10; el gate ejecuta lint y build ahora y gana `test` cuando llegue FE-10.

## Historias de usuario

- Como usuario, quiero que un cambio con un error de lint o de tipos nunca llegue a producción, para que el frontend tenga la misma red de seguridad que el backend.
- Como usuario, quiero que toda acción que hable con el backend me diga cuándo ha fallado, para no creer nunca que una orden se envió o un ajuste se guardó cuando no fue así.
- Como usuario, quiero que un error inesperado muestre un mensaje en vez de una pantalla en blanco, para poder recuperarme sin adivinar.

## Criterios de aceptación

- AC 1. CUANDO se hace push a `master` con cambios bajo `frontend/**` ENTONCES un job `check` ejecuta `npm ci`, `npm run lint` y `npm run build` en GitHub Actions, y el job `deploy` solo corre si `check` tiene éxito. CUANDO el check falla ENTONCES no se despliega nada.
- AC 2. `npm run lint` sale con 0 en `master`: los 29 errores y 4 avisos se corrigen en el código, no se silencian (ningún `eslint-disable` nuevo, ninguna regla quitada de `eslint.config.js`; un disable existente puede quitarse, nunca añadirse).
- AC 3. CUANDO `POST /commands` responde un estado no-2xx desde cualquiera de los cinco caminos de cierre/bloque/nueva orden ENTONCES el usuario ve un único toast de error con el texto `error` del backend y ningún toast de éxito; CUANDO responde 202 ENTONCES el comportamiento no cambia.
- AC 4. CUANDO `PUT /settings` falla ENTONCES la página muestra un error y no marca "Saved"; CUANDO falla crear/activar/borrar una alerta de precio o de EMA ENTONCES aparece un toast de error y la lista no queda en un estado incorrecto; CUANDO falla `PATCH /positions/color` ENTONCES el badge revierte y aparece un toast de error; CUANDO falla `PUT /chart-indicators` ENTONCES aparece un toast de error. CUANDO falla `POST /auth/logout` ENTONCES el usuario queda igualmente desconectado en local.
- AC 5. Un New Trade fallido produce exactamente un toast de error.
- AC 6. CUANDO ocurre un error de render de React en cualquier punto bajo el router ENTONCES un boundary a nivel de app muestra un mensaje con una acción "Reload" en vez de una pantalla en blanco; CUANDO ocurre un rechazo de promesa no manejado ENTONCES aparece un único toast de error (y el rechazo se registra en consola).
- AC 7. CUANDO `LightweightChart` lanza repetidamente ENTONCES `ChartErrorBoundary` deja de reintentar tras un número acotado de intentos y muestra su fallback con un reintento manual, en vez de remontar cada frame.
- AC 8. Las cards de órdenes pendientes muestran etiquetas con estilo (clase definida), y las tres clases `*Desktop` se definen con los estilos previstos o se quitan del JSX; la barra del Journal se ve igual que hoy en escritorio y móvil.
- AC 9. `npm run build` tiene éxito y la app desplegada se comporta como antes en todos los caminos de éxito (sin cambio visual salvo AC 8).

## Fuera de alcance

- `apiFetch` / `sendCommand` compartidos y 401 → login (FE-03).
- Cancelar respuestas obsoletas (FE-02).
- Vitest y el paso `test` del gate (FE-10).
- Deploy atómico del frontend y config de nginx (FE-06).
- Arreglar la selección de símbolo al cambiar de broker que tapa el `eslint-disable` de `ChartPage.tsx:211` (FE-02); ese disable se queda.
