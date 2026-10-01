# 008 · BE-11 — Base de herramientas del backend · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Las tareas de backend e infra nunca comparten commit. Orden de deploy: un push al final (deploy del backend; sin cambio de runtime esperado).

- [x] 1. [backend] Añadir devDependencies (`eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `vitest`), `eslint.config.js`, `vitest.config.ts`, `.nvmrc`, `tsconfig.test.json`; scripts de `package.json` (`typecheck`, `lint`, `test`, `test:watch`, quitar `start`) y `engines`; `noUnusedLocals`/`noUnusedParameters` + exclusión de tests en `tsconfig.json`. Corregir lo que reporten lint/typecheck (resto del scanner, nombres `_`, `// best effort` en catches vacíos) (AC 1, 2, 5). · **Verificar:** `npm run lint`, `npm run typecheck`, `npm run build` salen con 0; `npm test` corre con "no test files" y sale con 0 (o `--passWithNoTests`); diff revisado por cambios de comportamiento · **Est:** 1,5 SP
- [x] 2. [backend] Tests de `indicators/ema.ts` e `indicators/ema-cross.ts` (caracterización) (AC 3, 4). · **Verificar:** `npm test` en verde; las expectativas de ema calculadas a mano en los comentarios del test · **Est:** 1 SP
- [x] 3. [backend] Tests de `services/sizing.ts`, `middleware/parse.ts`, `middleware/loginLimiter.ts` (AC 4). · **Verificar:** `npm test` en verde · **Est:** 1 SP
- [x] 4. [backend] Extraer `services/stats-core.ts` (`computeStats` puro), dejar `computeBrokerStats` como adaptador de BD; test con el fixture de 3 meses/1 depósito (AC 4, 7). · **Verificar:** `npm test` en verde; `npm run build`; backend local + `smoke.mjs diff` en `/stats?…from…to` idéntico al baseline (recapturar el baseline sobre el `master` actual primero si hace falta — es del 2026-09-30) · **Est:** 1 SP
- [x] 5. [infra] Job `check` de CI: `npm run lint`, `npm run typecheck`, `npm test` tras `prisma generate` (AC 6). · **Verificar:** comprobación de estructura del YAML; primera ejecución real en la tarea 6 · **Est:** 0,25 SP
- [x] 6. [infra] Push `master` → `check` (lint + typecheck + test) y luego `deploy`; VPS: pm2 online, `/health` 200, `/version` incrementado; versión de Node del VPS registrada (`node -v`) frente a `engines`. **Validar en producción**: la página Stats de un broker con un rango de fechas coincide con los números previos al deploy (usuario) · **Verificar:** manual (validación del usuario + comprobaciones del operador) · **Est:** 0,5 SP
- [ ] 7. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), poner `Status: closed`, archivar en `archive/2026-10/`; rellenar la columna `Spec` de BE-11 en el informe de auditoría. · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 5,5 SP

Calibración: la auditoría dimensionó BE-11 en 5 SP con ±50 % ("la config de ESLint puede sacar a flote más de lo previsto"); +0,5 por la extracción de `stats-core` y su comprobación con el smoke.
