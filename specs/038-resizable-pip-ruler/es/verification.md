# 038 — Regla de pips redimensionable · Verificación

## Tarea 1 · [frontend] Regla seleccionable y redimensionable en `DrawingTools.ts`

- **Mecanismo:** `npm run build` + manual en el stack local (Vite 5174 → backend 3001 → BD de producción por túnel).
- **Comandos:** `npm run build` → ✓ built.
- **Resultado:** ✅ pass el 2026-11-07. El usuario midió una regla en el chart local: queda seleccionada con handles, arrastrar un handle la redimensiona y recalcula la etiqueta, arrastrar el cuerpo la mueve, clic fuera la deselecciona y clic encima la reselecciona, Supr / Escape / Borrar todo la eliminan, un cambio de timeframe la limpia, el bloqueo la ignora. Un comportamiento añadido a petición del usuario durante la prueba: elegir cualquier herramienta de dibujo también elimina la regla (AC 3 ampliado, `startDrawing` llama a `clearRuler`).
- **Est vs Actual:** 1.5 SP · 1 SP.
