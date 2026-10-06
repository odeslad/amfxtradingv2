# 014 · BE-09 — Índices de consulta y nombres heredados · Verificación

| # | Mecanismo | Comandos / pasos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint && npm run typecheck && npm test` · `npm run build` · `grep -rn emas backend/src` | ✅ | eslint limpio; tsc limpio (src y tests); 12 archivos / 80 tests pasan; build ok; el grep solo encuentra `routes/chart-indicators.ts` (lista de EMAs del usuario) y el código de alertas de EMA / scanner — no queda ninguna ruta `/emas` | 0.25 | 0.25 | — |
