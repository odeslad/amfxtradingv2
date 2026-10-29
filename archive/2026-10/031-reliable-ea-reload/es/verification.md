# 031 — Recarga fiable del EA tras el despliegue · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [infra] Reescribir `restart-mt4.ps1` | parseo local + revisión contra CA 1–7 | `[System.Management.Automation.Language.Parser]::ParseFile(...)` | ✅ pasa | 0 errores de parseo. CA 1: todo `/run` pasa por `Run-Watchdog` → `Wait-WatchdogIdle` (`State` de la tarea, tope 120 s). CA 2/3: el código de salida sale solo de la comprobación final (cada exe inicial corriendo con `SessionId ≠ 0`, límite 720 s), los que faltan se listan como `[FAILED]`. CA 4: terminal lento → `[WARN]` a los 90 s. CA 6: sin `Start-Process`. CA 7: caso sin terminales sin cambios. CA 5 (duración) se mide en la tarea 2 | 1 | 0.5 |
| 2. [infra] Validar en producción | manual (validación del usuario) | push `320ccb8..78efba0` → `Deploy EA to VPS` | ✅ pasa | Job en verde en 5 min 1 s en total (CA 5). Los 12 terminales registran `Started:` justo después de pararse, sin `[WARN]` ni `[FAILED]` (CA 1–4). El problema de la ejecución #41 (6 `[FAILED]` falsos y unos 15 min) ha desaparecido | 0.5 | 0.25 |
| 3. [specs] Cerrar la spec | manual | `git mv` a `archive/2026-10/` | ✅ pasa | Est vs Real registrado, estado cerrado | 0.25 | 0.25 |

## Est vs Real

**Total: 1.75 SP estimados · 1 SP real.** Calibración: un cambio pequeño de un script de infra con la causa raíz clara llevó la mitad de lo estimado. Casi todo el coste real fue esperar al pipeline.
