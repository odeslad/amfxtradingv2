# 034 — Candado del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|-------|-----------|----------|-----------|-----------|-----|------|
| 1 | build + comprobación local | `npm run build`, `npx eslint` sobre los ficheros tocados | ✅ build, lint y comprobación local (usuario) | Build y lint limpios. Usa el hook existente `useLocalStorage` (clave `chart.locked`) en lugar de una lectura/escritura a mano | 0.75 | 0.25 |
| 2 | build + comprobación local | `npm run build`, `npx eslint src/features/chart`, Vite local contra la API de producción | ✅ | El usuario lo comprobó en local: el candado alterna y sobrevive a la recarga; arrastrar / rueda sobre dibujos, líneas SL/TP, etiquetas de posición y alertas mueve el gráfico; elegir Trendline lo quita; sin candado todo igual | 1.5 | 0.5 |
| 3 | manual (usuario, producción) | push de `master` → deploy del frontend | ✅ | El usuario lo validó en producción, escritorio y móvil: el candado bloquea dibujos, SL/TP, etiquetas de posición y alertas; la recarga lo mantiene; Trendline lo quita. Se detectó el desbordamiento de la barra en móvil y se corrigió en `2829401` (Indicadores pasa a la fila de Draw) | 0.25 | 0.25 |
| 4 | manual | `npm run build` final, archivo | ✅ | Spec cerrada y archivada | 0.25 | 0.1 |

## Est vs Real

**Total**: 2.75 SP estimados · 1.1 SP reales.

Calibración: los toggles del gráfico solo de frontend reutilizan hooks y guardas existentes y salen muy por debajo de lo estimado; la única sorpresa fue el ancho de la barra en móvil — revisar el presupuesto de la fila móvil cada vez que se añade un botón.
