# 031 — Recarga fiable del EA tras el despliegue · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: el script sale con cualquier push a `ea/**`; la validación es un `workflow_dispatch` manual de `Deploy EA to VPS`.

- [x] 1. [infra] Reescribir `ea/scripts/restart-mt4.ps1`: `Wait-WatchdogIdle` (`State` de la tarea, tope 120 s) antes de cada `/run`, espera blanda por terminal de 90 s → `[WARN]`, comprobación final de todos los exe iniciales en sesión ≠ 0 dentro de `-TimeoutSec` (12 min), exit 1 solo listando los que faltan; sin cambios en el caso sin terminales ni `Start-Process terminal.exe` · **Verificar:** parseo local con `[System.Management.Automation.Language.Parser]::ParseFile` (sin errores) + revisión contra CA 1–7 · **Est:** 1 SP
- [x] 2. [infra] Push de `master` y **validar en producción**: lanzar `Deploy EA to VPS` por `workflow_dispatch` en un momento tranquilo; en el paso "Reload the EA on every terminal" comprobar sin `[FAILED]`, `Terminals running: 12/12`, job en verde, paso por debajo de ~6 min; después `/health` muestra todos los pipes `connected` · **Verificar:** manual (validación del usuario) · **Est:** 0.5 SP
- [x] 3. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/YYYY-MM/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 1.75 SP
