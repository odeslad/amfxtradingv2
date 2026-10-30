# 034 — Candado del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|-------|-----------|----------|-----------|-----------|-----|------|
| 1 | build + comprobación local | `npm run build`, `npx eslint` sobre los ficheros tocados | ✅ build, lint y comprobación local (usuario) | Build y lint limpios. Usa el hook existente `useLocalStorage` (clave `chart.locked`) en lugar de una lectura/escritura a mano | 0.75 | 0.25 |
| 2 | build + comprobación local | `npm run build`, `npx eslint src/features/chart`, Vite local contra la API de producción | ✅ | El usuario lo comprobó en local: el candado alterna y sobrevive a la recarga; arrastrar / rueda sobre dibujos, líneas SL/TP, etiquetas de posición y alertas mueve el gráfico; elegir Trendline lo quita; sin candado todo igual | 1.5 | 0.5 |
