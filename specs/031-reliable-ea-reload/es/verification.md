# 031 — Recarga fiable del EA tras el despliegue · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [infra] Reescribir `restart-mt4.ps1` | parseo local + revisión contra CA 1–7 | `[System.Management.Automation.Language.Parser]::ParseFile(...)` | ✅ pasa | 0 errores de parseo. CA 1: todo `/run` pasa por `Run-Watchdog` → `Wait-WatchdogIdle` (`State` de la tarea, tope 120 s). CA 2/3: el código de salida sale solo de la comprobación final (cada exe inicial corriendo con `SessionId ≠ 0`, límite 720 s), los que faltan se listan como `[FAILED]`. CA 4: terminal lento → `[WARN]` a los 90 s. CA 6: sin `Start-Process`. CA 7: caso sin terminales sin cambios. CA 5 (duración) se mide en la tarea 2 | 1 | 0.5 |
