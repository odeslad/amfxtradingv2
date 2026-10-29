# 031 — Recarga fiable del EA tras el despliegue · Diseño

## Por qué hoy es lento y sale en rojo

`restart-mt4.ps1`, por terminal: lo cierra (≤10 s) → `schtasks /run AMFX-Watchdog` → espera hasta 120 s a que vuelva.

Una ejecución del Watchdog (`infra/scripts/startup.ps1`) comprueba Postgres y la salud del backend, arranca cada terminal que falte y **duerme `TerminalDelay` = 20 s tras cada uno**. La tarea es `IgnoreNew`, así que mientras duerme sigue `Running` y el siguiente `/run` se descarta. El script ya ha parado el siguiente terminal, su `/run` se pierde, y ese terminal solo vuelve cuando algún `/run` posterior cae con la tarea libre — a menudo pasados 120 s → `[FAILED]` falsos, y un `exit 1` que depende de esa marca por terminal aunque la cuenta final sea 12/12.

## Enfoque (recomendado): de uno en uno, esperando a que el Watchdog esté libre

Seguir recargando de uno en uno (solo un broker sin EA en cada momento, y los arranques de terminales siguen escalonados — los picos de memoria al arrancar estaban detrás de los BSOD del VPS), pero haciendo que cada `/run` cuente:

```
por cada terminal en marcha al principio:
    cerrarlo (CloseMainWindow, 10 s, luego Stop-Process -Force)
    Wait-WatchdogIdle            # sondear el State de Get-ScheduledTask hasta que no sea 'Running'
    schtasks /run AMFX-Watchdog
    esperar a que ese exe vuelva a correr en sesión ≠ 0 (límite blando 90 s → WARN, seguir)
al final:
    Wait-WatchdogIdle y un último /run si aún falta alguno
    esperar a que todos los exe iniciales corran en sesión ≠ 0, o al límite global
    exit 0 si han vuelto todos; si no, listar los que faltan y exit 1
```

- El siguiente terminal se cierra mientras el Watchdog aún está en su pausa de 20 s, así que el cierre se solapa con la pausa: ~25–30 s por terminal → **~5–6 min para 12** (CA 5), frente a ~15 min hoy.
- **La pausa `TerminalDelay` de 20 s se mantiene a propósito** (lanzar terminales a la vez daba problemas): solo el *cierre* del siguiente terminal se solapa con la pausa del Watchdog, nunca dos arranques. Como `/run` solo se lanza con el Watchdog libre, dos arranques de terminal siempre quedan a ≥ 20 s.
- `Wait-WatchdogIdle` usa `(Get-ScheduledTask -TaskName AMFX-Watchdog).State`; tiene su propio timeout (p. ej. 120 s) para que un Watchdog colgado no bloquee el despliegue para siempre — entonces registra un aviso y lanza `/run` igualmente.
- El código de salida depende solo del estado final (CA 2, CA 3); un terminal lento es una línea `[WARN]` (CA 4).
- Límite global: 12 min (parámetro `-TimeoutSec`), muy por dentro del límite del job de GitHub; no hace falta cambiar el workflow.
- "Ha vuelto" = el mismo `ExecutablePath` corriendo con `SessionId ≠ 0` (CA 2, CA 6).
- Sin cambios: nunca `Start-Process terminal.exe` desde SSH (CA 6); sin terminales al principio → un `/run` y exit 0 (CA 7).

## Alternativa: parar todos, una ejecución del Watchdog

Parar los 12 terminales y lanzar el Watchdog una vez; los arranca todos, con 20 s entre uno y otro.
- **Pro:** lo más simple; ~4 min en total.
- **Contra:** todos los brokers se quedan sin EA a la vez (el último ~4 min, todos los pipes en `listening`); un arranque fallido deja toda la flota caída hasta la siguiente ejecución periódica del watchdog.
- Descartada: el enfoque de uno en uno es casi igual de rápido y mantiene 11 de 12 brokers vivos en todo momento.

## Archivos
- `ea/scripts/restart-mt4.ps1` (reescritura del bucle y de la regla de salida).
- Sin cambios en `infra/scripts/startup.ps1`, la tarea AMFX-Watchdog ni `deploy-ea.yml`.

## Verificación
El script solo corre en el VPS contra los terminales reales, y una ejecución los reinicia todos. La verificación es la real: lanzar `Deploy EA to VPS` por `workflow_dispatch` (sin cambiar el EA) en un momento tranquilo y revisar el log del paso: sin `[FAILED]`, `Terminals running: 12/12`, job en verde, duración del paso por debajo de ~6 min. Antes del push el script se parsea en local (`[System.Management.Automation.Language.Parser]::ParseFile`).

## Riesgos
- **Reinicia todos los terminales**: la ejecución de validación es una recarga real; hacerla sin posiciones gestionadas a mano o asumiendo unos segundos sin EA por broker, como en cualquier despliegue del EA.
- **El Watchdog también corre según su programación**: puede haber una ejecución periódica en marcha cuando arranca el script; `Wait-WatchdogIdle` lo cubre.
- **Un terminal que de verdad no arranca** (instalación rota, crash al arrancar): se informa al final con exit 1, como se busca.
