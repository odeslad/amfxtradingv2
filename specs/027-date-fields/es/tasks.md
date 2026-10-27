# 027 — Un único campo de fecha · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: solo frontend.

- [x] 1. [frontend] `lib/dateField.ts`, `DateField` + `IsoDateField` + `Calendar` (desplegable de escritorio dentro del área visible, panel inferior en el teléfono), aplicados a los paneles del libro de esquemas (Apertura / Cierre de la operación, Inicio / Fin del esquema) · **Verificar:** `npm run build` + `npm run lint`; app local con el proxy Vite a producción: escribir `121020261400`, borrar a través de separadores, pegar, una fecha no válida bloquea el guardado, elegir días en el calendario (desplegable alineado a la derecha en la columna Fin / Cierre, se abre hacia arriba cerca del borde inferior), editar un esquema y una operación existentes (valores en el formato nuevo, valores guardados sin cambios), lo mismo a 390 px con el panel inferior · **Est:** 3 SP
- [x] 2. [frontend] Ends de la notificación EMA, From / To de los filtros del Journal y From / To de los filtros de Stats con el campo compartido · **Verificar:** `npm run build` + `npm run lint`; app local: crear / editar una notificación con fin (guardada como hoy), aplicar un rango de fechas personalizado en Journal y en Stats (mismas filas que antes), reabrir los filtros (fechas en el formato nuevo), escritorio y 390 px · **Est:** 1,5 SP
- [ ] 3. [infra] Push de `master` (despliegue del frontend) y **validar en producción**: escritorio e iPhone, los nueve campos contra los CA 1–8 · **Verificar:** manual (validación del usuario) · **Est:** 0,5 SP
- [ ] 4. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec cerrada y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 5,25 SP
