# 038 — Regla de pips redimensionable · Verificación

## Tarea 1 · [frontend] Regla seleccionable y redimensionable en `DrawingTools.ts`

- **Mecanismo:** `npm run build` + manual en el stack local (Vite 5174 → backend 3001 → BD de producción por túnel).
- **Comandos:** `npm run build` → ✓ built.
- **Resultado:** ✅ pass el 2026-11-07. El usuario midió una regla en el chart local: queda seleccionada con handles, arrastrar un handle la redimensiona y recalcula la etiqueta, arrastrar el cuerpo la mueve, clic fuera la deselecciona y clic encima la reselecciona, Supr / Escape / Borrar todo la eliminan, un cambio de timeframe la limpia, el bloqueo la ignora. Un comportamiento añadido a petición del usuario durante la prueba: elegir cualquier herramienta de dibujo también elimina la regla (AC 3 ampliado, `startDrawing` llama a `clearRuler`).
- **Est vs Actual:** 1.5 SP · 1 SP.

## Tarea 2 · [infra] Push + validación en producción

- **Mecanismo:** manual (validación del usuario).
- **Comandos:** `git push origin master` (`59cccfb..23a457a`, solo deploy de frontend); el bundle servido cambió tras el deploy.
- **Resultado:** ✅ pass (validado por el usuario el 2026-11-07 en https://v2.amfxtrading.com: AC 1–6).
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Tarea 3 · [specs] Cierre

- **Mecanismo:** manual. `npm run build` (frontend) → ✓ built.
- **Resultado:** ✅ cerrada el 2026-11-07, archivada en `archive/2026-11/`.
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Est vs Actual

| Tarea | Est | Actual |
|---|---|---|
| 1 Regla seleccionable y redimensionable | 1.5 | 1 |
| 2 Push + validación en producción | 0.25 | 0.25 |
| 3 Cierre | 0.25 | 0.25 |
| **Total** | **2** | **1.5** |

Calibración: las rutas de dos anclas de la spec 037 cubrieron medición, arrastre y táctil; la regla solo necesitó su estado propio, su hit test y sus reglas de limpieza. Desviación acordada en la tarea 1: elegir cualquier herramienta de dibujo también elimina la regla (AC 3). Nada pendiente del usuario.
