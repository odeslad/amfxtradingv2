# 008 · BE-11 — Base de herramientas del backend

> Estado: **cerrada**
> Origen: [auditoría del backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 11 (diagnóstico G)

## Contexto

El backend no tiene linter, ni formateador, ni ejecutor de tests, ni scripts `lint`/`typecheck`/`test`; la única red es `tsc` (y, desde la spec 005, el job `check` de CI que lo ejecuta). El frontend ya estandarizó ESLint 10 flat config + `typescript-eslint` 8 (sin Prettier). Las specs 004–007 verificaron cada cambio con scripts desechables y pruebas de humo manuales; los siguientes puntos de la auditoría (BE-06 comandos, BE-07 sizing, BE-09 consultas EMA acotadas) tocan cálculos con dinero y merecen tests unitarios. Además, `tsconfig` no señala locales/parámetros sin usar, lo que oculta un resto real (`services/scanner.ts:78-79`).

## Capas afectadas

- backend
- infra (el job `check` de CI ejecuta lint y tests)

## Dependencias nuevas (devDependencies, propuestas)

| Paquete | Por qué |
|---|---|
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | mismo stack y versiones que el frontend; una convención para el monorepo |
| `vitest` | tests en TypeScript sin paso de build; el frontend aún no tiene ejecutor, así que esto fija el estándar para ambos |

Sin cambios en dependencias de runtime.

## Historias de usuario

- Como desarrollador, quiero `npm run lint`, `npm run typecheck` y `npm test` en el backend, para que cada cambio se compruebe igual en local y en CI.
- Como desarrollador, quiero tests unitarios en los módulos de cálculo puro, para que los próximos cambios en sizing, consultas e indicadores no alteren sus resultados sin que se note.
- Como operador, quiero que CI rechace un push cuyo lint o tests fallen, para que el gate añadido en la spec 005 cubra más que los tipos.

## Criterios de aceptación

- AC 1. CUANDO se ejecuta `npm run lint` en `backend/` ENTONCES ESLint (flat config, `@eslint/js` recommended + `typescript-eslint` recommended, globals de Node) comprueba `src/**/*.ts` y `scripts/*.ts` y sale con 0 en `master` — los hallazgos preexistentes se corrigen en esta spec o, si cambian comportamiento, se listan como `eslint-disable-next-line` explícitos con motivo.
- AC 2. CUANDO se ejecuta `npm run typecheck` ENTONCES `tsc --noEmit` pasa con `noUnusedLocals` y `noUnusedParameters` activados; se eliminan los `lastSetup` / `candlesSinceCross` sin usar de `services/scanner.ts`.
- AC 3. CUANDO se ejecuta `npm test` ENTONCES Vitest ejecuta `src/**/*.test.ts` y pasa; los tests no necesitan base de datos, red ni ficheros bridge.
- AC 4. CUANDO la primera batería de tests está en su sitio ENTONCES cubre: `indicators/ema.ts` (valores EMA conocidos sobre una serie fija, nulls de calentamiento), `indicators/ema-cross.ts` (un cruce alcista y uno bajista sintéticos con su índice de activación, dirección y niveles), `services/sizing.ts` (EURUSD/USDJPY/GBPCHF con cuenta EUR/USD, conversión directa/inversa/ausente), `services/stats.ts` (un periodo de 3 meses con un depósito: netPnl, cashFlow, startBalance, returnPct mensual, longitud de la curva), `middleware/parse.ts` (los casos de la tarea 3 de la spec 004), `middleware/loginLimiter.ts` (ventana, bloqueo, reinicio).
- AC 5. CUANDO se lee `package.json` ENTONCES declara `"engines": { "node": ">=20" }` y existe un `.nvmrc` con `20`; `npm start` se elimina (pm2 usa el ecosystem) o se mantiene — decisión en el diseño.
- AC 6. CUANDO corre el job `check` de CI ENTONCES ejecuta `npm run lint`, `npm run typecheck` y `npm test` tras `prisma generate`, y el job de deploy sigue dependiendo de él.
- AC 7. CUANDO todo lo anterior está integrado ENTONCES la salida de `npm run build` y el comportamiento en runtime no cambian (sin cambios de código de producción más allá de quitar locales muertos y arreglos de lint que preservan comportamiento).

## Fuera de alcance

- Prettier (el frontend no lo tiene; puede seguir una spec de formateo para todo el monorepo).
- Arreglos de lint del frontend (33 problemas preexistentes — auditoría del frontend).
- Tests de rutas/BD (necesitarían una base de datos de test); la cobertura de integración sigue en el script de humo.
- Actualizar Express o Prisma.
