# 022 — Eliminar la sección Scanner · Diseño

## Enfoque

Una retirada limpia: se van todos los ficheros del scanner, se cortan las referencias a su alrededor y
la documentación lo sigue. No se conserva código muerto; los requisitos registran dónde encontrarlo en
git. Dos commits atómicos, uno por capa, primero el frontend (la página deja de llamar al endpoint antes
de que el endpoint desaparezca).

Alternativas consideradas: dejar `services/scanner.ts` sin ruta para la futura sección — descartada
(código sin uso que lint y cualquier lector tienen que sortear; git lo guarda igual de bien).

## Frontend

Borrar `src/features/scanner/` (`ScannerPage.tsx`, `ScannerPage.module.css`) y `src/lib/useScanner.ts`.
`app/Router.tsx`: quitar el import de `ScannerPage` y la ruta `/scanner`; la ruta `*` existente manda las
rutas desconocidas a `/`, así que `/scanner` aterriza en `/journal`. `app/layout/AppLayout.tsx`: quitar la
entrada Scanner de la navegación y el import de su icono; `shared/ui/icons.tsx`: quitar `IconScanner` (su
único consumidor). Barra inferior móvil: cinco entradas en vez de seis, mismo componente, sin cambio de
CSS (la barra se reparte con `flex`).

Sin tocar: `NewTradePanel` (lee `/setup-levels`), las herramientas de EMA del gráfico, las alertas EMA.

## Backend

Borrar `src/routes/scanner.ts` y `src/services/scanner.ts`; `app.ts` pierde el import y la línea
`app.use('/scanner', …)` (16 routers). `indicators/ema.ts`, `indicators/ema-cross.ts`,
`indicators/pip-size.ts` e `indicators/timeframe.ts` se quedan: los importan `routes/setup-levels.ts`, las
alertas EMA y los indicadores del gráfico. `npm run build` demuestra que nada más importaba el scanner.

## Documentación

`backend/docs/architecture.md`: la línea del árbol de `services/scanner.ts`, la fila `/scanner` de la
tabla de endpoints y cualquier recuento de routers. `.claude/CLAUDE.md`: la lista de routers (17 → 16).

## Maqueta

No se añade ni cambia ninguna pantalla; la navegación pierde una entrada. Sin maqueta.

## Riesgos

- Un marcador a `/scanner` abre ahora el Journal: intencionado.
- Ninguno sobre la operativa: ningún comando, alerta ni ruta del EA toca el scanner.
