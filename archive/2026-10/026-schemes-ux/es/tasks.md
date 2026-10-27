# 026 — UX de la página de esquemas · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: solo frontend.

- [x] 1. [frontend] Escritorio: cabecera con barra de pestañas, franja de totales, columnas de la tabla de esquemas, acciones de fila al pasar el ratón como en el Journal en esquemas y operaciones, tabla de operaciones en 10 columnas, resultado sin borde, paginación compacta · **Verificar:** `npm run build` + `npm run lint`; app local con el proxy Vite a producción en ancho de escritorio: las pestañas cambian el año, las acciones entran al pasar el ratón y abren los paneles correctos, sin scroll lateral en las operaciones desplegadas · **Est:** 2 SP
- [x] 2. [frontend] Lista en móvil: pestañas y botón nuevo a ancho completo, bloque de totales, `SchemeCard` (cerrada / abierta con Ver operaciones y las tres acciones), paginación de 44 px · **Verificar:** `npm run build` + `npm run lint`; app local a 390 px: tamaños y etiquetas de las cards como en la maqueta, abrir / cerrar, Editar / Eliminar / + Operación abren sus paneles · **Est:** 1,5 SP
- [x] 3. [frontend] Operaciones en móvil: `OperationsPanel` + `OperationCard` (formato de card de Positions, Editar / Eliminar al deslizar, toque para desplegar, + Nueva operación), refresco tras crear / editar / borrar · **Verificar:** `npm run build` + `npm run lint`; app local a 390 px: abrir el panel, desplegar una operación, deslizarla y editarla (el panel se apila y vuelve), borrar una, añadir una; la lista y los totales se actualizan · **Est:** 2 SP
- [x] 4. [infra] Push de `master` (despliegue del frontend) y **validar en producción**: escritorio e iPhone contra los CA 1–10 · **Verificar:** manual (validación del usuario) · **Est:** 0,5 SP
- [x] 5. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec cerrada y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 6,25 SP
