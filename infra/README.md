# Infra — arranque automático del VPS

Scripts de operación del servidor que no pertenecen a ninguna capa (EA, backend, frontend).

## Qué hace

Tras un reinicio del VPS, Windows entra solo con `Administrator` y dos tareas programadas
levantan el backend (pm2) y los 10 terminales MT4 de `backend/brokers.json`, sin intervención manual.

```
reinicio → autologon Administrator
              │
              ├── AMFX-Startup   (al iniciar sesión, +1 min)  → startup.ps1
              └── AMFX-Watchdog  (cada 5 min)                 → startup.ps1
```

## `scripts/startup.ps1`

Idempotente. En cada ejecución:

1. Espera a que `postgresql-x64-17` esté en marcha (máx. 120 s).
2. Backend: si `http://localhost:3000/health` no responde, `pm2 resurrect`; si sigue caído,
   `pm2 start dist/index.js` con los mismos flags que `backend/scripts/deploy.ps1` y `pm2 save`.
3. Terminales: por cada broker de `brokers.json` resuelve `bridgePath → data dir → origin.txt → terminal.exe`
   y lo lanza si no hay ya un proceso con ese ejecutable. 20 s entre lanzamientos para no saturar el VPS.
4. Escribe el resultado en `C:\monitoring\startup.log` (`OK` o `DEGRADED (backend=… terminals=…)`).

Un terminal que se cierre a mitad del día lo relanza el watchdog en menos de 5 minutos.

## `scripts/register-startup-tasks.ps1`

Registra (o reemplaza) las dos tareas. Ejecutar una vez en el VPS:

```powershell
powershell -ExecutionPolicy Bypass -File C:\amfxtradingv2\infra\scripts\register-startup-tasks.ps1
```

Las tareas corren como `Administrator` en modo **interactivo** (no en sesión 0), para que las
ventanas de MT4 sean visibles por RDP. Por eso solo se ejecutan con la sesión abierta, y por eso
hace falta el autologon.

## Autologon (paso manual, una sola vez)

Requiere la contraseña de `Administrator`; hacerlo por RDP en el VPS con
[Autologon de Sysinternals](https://learn.microsoft.com/sysinternals/downloads/autologon),
que guarda la contraseña cifrada como secreto LSA (no en texto plano en el registro):

```powershell
Invoke-WebRequest https://live.sysinternals.com/Autologon64.exe -OutFile C:\deploy\Autologon64.exe
C:\deploy\Autologon64.exe /accepteula Administrator WIN-16ESVKMCVCR <contraseña>
```

Si se cambia la contraseña de `Administrator`, hay que volver a ejecutarlo.

## Comprobar

```powershell
Get-Content C:\monitoring\startup.log -Tail 20
Get-ScheduledTask -TaskName 'AMFX-*' | Format-Table TaskName, State
Get-ScheduledTaskInfo -TaskName AMFX-Watchdog | Select-Object LastRunTime, LastTaskResult
```

## Lo que no cubre

- Cuenta de broker con contraseña caducada o no guardada en el terminal: MT4 arranca pero no conecta.
- Pantallas que Windows muestre al arrancar (raro en Server) y que bloqueen el autologon.
