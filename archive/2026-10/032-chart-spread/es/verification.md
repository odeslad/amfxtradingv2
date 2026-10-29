# 032 — Spread en el gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [db] Columna `showSpread` + migración | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pasa | Cliente generado, `tsc` sin errores. La migración `20261029000000_show_spread` añade `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
| 2. [backend] `/settings` lee y escribe `showSpread` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pasa | 3/3 tests: ausente → undefined (se conserva el valor guardado), booleano aceptado, no booleano → `BadRequest` (400). El GET devuelve `showSpread ?? false`; el PUT lo escribe solo si viene. Desviación: no había fichero de test de rutas, así que el test cubre `parseDisplay` (ahora exportada) en lugar de un GET/PUT completo contra la BD | 0.5 | 0.25 |
| 3. [frontend] Interruptor de spread en Settings › Display | build + revisión en local contra la maqueta | `npm run build`, eslint, Vite local contra la API de producción | ✅ pasa | Build y lint sin errores. El usuario revisó la fila nueva bajo "Rectangle labels" (desactivada por defecto, se conserva tras guardar y recargar) contra la maqueta | 0.5 | 0.25 |
| 4. [frontend] Líneas ASK y BID en el gráfico | build + revisión en local (CA 1–6) | `npm run build`, eslint, Vite local contra la API de producción | ✅ pasa | Build y lint sin errores. El usuario lo revisó en local: las líneas ASK y BID con etiqueta en el eje sustituyen a la línea de precio actual y se mueven con los ticks; al desactivar la opción vuelve la línea única. Desviación: ASK en el mismo gris que BID (discontinua frente a punteada) en vez de rojo, a petición del usuario; anotado en design.md | 1.5 | 0.75 |
| 5. [infra] Push y validar en producción | manual (validación del usuario) | push `fb76b1d..57813bd` (backend, migración aplicada), push `57813bd..70bc2ca` (frontend) | ✅ pasa | El usuario lo confirmó en producción: interruptor en Settings › Display, líneas ASK y BID en el gráfico moviéndose con el precio, línea única al desactivarlo, ajuste compartido entre dispositivos | 0.5 | 0.25 |
| 6. [specs] Cerrar la spec | manual | `git mv` a `archive/2026-10/` | ✅ pasa | Est vs Real registrado, estado cerrado | 0.25 | 0.1 |

## Est vs Real

**Total: 3.5 SP estimados · 1.7 SP real.** Calibración: el precedente de `rectLabels` (spec 025) convirtió cada capa en copia de un patrón conocido, así que llevó la mitad de lo estimado. Desviaciones: ASK en gris en vez de rojo (petición del usuario); el test del backend cubre `parseDisplay` en lugar de un GET/PUT contra la BD.
