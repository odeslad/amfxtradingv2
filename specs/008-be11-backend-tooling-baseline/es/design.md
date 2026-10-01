# 008 · BE-11 — Base de herramientas del backend · Diseño

> Estado: **aprobada**

## Enfoque

Calcar el stack de lint del frontend, añadir Vitest, endurecer `tsconfig`, añadir scripts y los pasos de CI — y después escribir los primeros tests solo sobre módulos puros. Orden: primero herramientas (para escribir los tests sobre una base ya linteada), luego tests, CI al final.

## 1. ESLint — `backend/eslint.config.js`

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dist.prev', 'dist.next', 'node_modules', 'ecosystem.config.js']),
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
```

Mismas versiones que el frontend (`eslint ^10.3`, `@eslint/js ^10.0`, `typescript-eslint ^8.59`, `globals ^17.6`). `ecosystem.config.js` es CommonJS y se ignora. La excepción del prefijo `_` coincide con el código existente (`_req`, `_maxAge`, `_next`).

Hallazgos preexistentes esperados (del inventario de `as`/`any` de la auditoría): `no-non-null-assertion` **no** está en `recommended` (el patrón `req.userId!` se queda); `no-explicit-any` tiene 0 casos reales (los 3 `any` están en comentarios); los probables son `no-unused-vars` (resto de `scanner.ts`, los destructurados `_`) y `no-empty` en bloques `catch {}` (`commands.ts:50`, `index.ts:48`) — reciben un comentario de una línea dentro del bloque (`// best effort`), que satisface la regla sin cambiar comportamiento.

## 2. TypeScript — `tsconfig.json`

Añadir `"noUnusedLocals": true, "noUnusedParameters": true`. `scripts/tsconfig.json` lo extiende y hereda ambos. Corregir `services/scanner.ts:78-79` (borrar `lastSetup` / el `candlesSinceCross` exterior; el `buildRow` interno calcula el suyo).

## 3. Vitest — `backend/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } });
```

Los tests van junto al módulo (`src/indicators/ema.test.ts`). El `include: ["src"]` de `tsconfig.json` ya los cubre; `exclude` gana `"src/**/*.test.ts"` para que `tsc` (el build de producción) no emita ficheros de test en `dist/`. ESLint los lintea (son `src/**/*.ts`); no se usan globals de `vitest` (`import { describe, it, expect } from 'vitest'` explícito).

## 4. Scripts y engines — `package.json`

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate": "prisma migrate deploy",
  "db:generate": "prisma generate",
  "db:studio": "prisma studio"
},
"engines": { "node": ">=20" }
```

`start` se elimina: nada lo llama (pm2 usa `ecosystem.config.js`, dev usa `tsx`), y mantener una segunda forma de arrancar la app contradice la definición única de la spec 005. `.nvmrc` = `20` (el job de CI fija 20; el VPS corre lo que tenga instalado — comprobado en la verificación de la tarea 7).

## 5. Tests (AC 4)

Solo módulos puros; cada fichero de test construye sus entradas inline.

| Fichero | Qué fija |
|---|---|
| `indicators/ema.test.ts` | `calculateEma` sobre `[1..10]` con periodo 3: dos primeros `null`, luego la serie calculada a mano (semilla SMA y `α = 2/(n+1)`), longitud preservada. |
| `indicators/ema-cross.test.ts` | Una serie de 60 barras que baja y luego sube: exactamente un setup `buy` tras el giro con `activationIndex` en la primera barra donde rápida > lenta, `levels.ECC` = cierre de esa barra, `levels.EMA` entre las dos EMAs; serie espejo → un `sell`. Lo que `detectEmaCrossSetups` devuelva hoy se captura como expectativa **tras** leer la implementación — son tests de caracterización, no una rederivación. |
| `services/sizing.test.ts` | `calculateLots`: EURUSD, cuenta USD, 1 % de 10 000, SL 20 pips → 0,5 lotes; USDJPY cuenta USD con bid USDJPY 150 → conversión inversa; GBPCHF cuenta EUR sin tick CHFEUR/EURCHF → cae a base (documenta el hallazgo BE-07 de la auditoría como comportamiento actual); suelo `Math.max(0.01)`; redondeo a 2 decimales. |
| `services/stats.test.ts` | `computeBrokerStats` depende de `db` → extraer el núcleo puro a `services/stats-core.ts` (`computeStats(latest, trades, operations, from, to)`) y dejar `computeBrokerStats` como adaptador de BD. Test: 3 meses, 4 trades, 1 depósito a mitad: `netPnl`, `cashFlow`, `startBalance = ancla − movimientos posteriores`, `monthly[].returnPct` con la regla de inicio efectivo, `curve.length` = días del periodo. Es el único refactor de código de producción de la spec; la salida de `computeBrokerStats` sigue idéntica byte a byte (verificado con el diff del smoke). |
| `middleware/parse.test.ts` | Los 35 casos de la tarea 3 de la spec 004 (portados del snippet desechable). |
| `middleware/loginLimiter.test.ts` | Inyección de `now` (las funciones ya aceptan `now`): 10 fallos → no bloqueado, 11º → bloqueado, tras `WINDOW_MS` → liberado, `clearFailures` reinicia. |

## 6. CI — `.github/workflows/deploy-backend.yml`

Pasos del job `check` tras `Prisma generate`: `npm run lint`, `npm run typecheck`, `npm test`. El build no cambia (`deploy.ps1` sigue ejecutando `tsc` en el VPS).

## Archivos a tocar

- nuevos: `backend/eslint.config.js`, `backend/vitest.config.ts`, `backend/.nvmrc`, seis `*.test.ts`, `backend/src/services/stats-core.ts`
- `backend/package.json` (+ lockfile), `backend/tsconfig.json`, `backend/src/services/scanner.ts`, `backend/src/services/stats.ts` (adaptador), retoques dirigidos por lint
- `.github/workflows/deploy-backend.yml`

## Riesgos

- **`npm install` de ESLint 10 / typescript-eslint 8 en Node 24 local vs 20 en CI**: ambos soportados; el frontend ya corre este stack.
- **El `exclude` de los tests en `tsc`** no debe excluirlos del `typecheck`: `tsc --noEmit` usa el mismo tsconfig → los tests no quedarían tipados. Mitigación: Vitest tampoco tipa; añadir `"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.test.json"` con un `tsconfig.test.json` mínimo que incluya solo los tests. Decisión: hacerlo — son dos líneas y mantiene honestos los tests.
- **La extracción de `stats-core`** es un refactor de código que reporta dinero: cubierto por el test unitario nuevo *y* por el `diff` del smoke sobre `/stats` antes del deploy.
- **Arreglos de lint que deriven en cambios de comportamiento**: cada arreglo se revisa en el diff del commit de la tarea 1; lo no mecánico recibe un `disable-next-line` con motivo en vez de un cambio.
