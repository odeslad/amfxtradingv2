# 034 — Candado del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|-------|-----------|----------|-----------|-----------|-----|------|
| 1 | build + comprobación local | `npm run build`, `npx eslint` sobre los ficheros tocados | 🕐 build ✅, comprobación local pendiente (alternar + recarga) junto con la tarea 2 | Build y lint limpios. Usa el hook existente `useLocalStorage` (clave `chart.locked`) en lugar de una lectura/escritura a mano | 0.75 | 0.25 |
