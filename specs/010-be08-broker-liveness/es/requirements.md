# 010 · BE-08 — Vitalidad por broker

> Status: **draft**
> Origin: [auditoría backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 8 (diagnósticos A, E)

## Contexto

Cada broker tiene un `PipeReader` (named pipe, ticks/posiciones/cuenta desde el EA) y un `FileWatcher` (ficheros del bridge cada 30 s). Si `server.listen` sobre el pipe falla (nombre en uso, una instancia anterior del backend que aún lo retiene, un error transitorio de Windows), el error se registra una vez y nunca se reintenta: ese broker queda muerto hasta que el backend se reinicia, mientras `GET /health` sigue respondiendo `{ status: "ok" }` — la única señal que miran el script de deploy, la tarea de arranque y el operador. Nada registra cuándo un broker envió algo por última vez: la web muestra el último precio conocido aunque tenga horas y nadie puede saber, desde el backend, cuál de los doce EAs se ha parado. Además se tragan dos fallos: `syncColors(...).catch(() => {})` en `index.ts` y el error de `readdir` del watcher (registrado, pero con el objeto de error entero en vez del mensaje, cada 30 s).

## Capas afectadas

- backend

Sin cambios en frontend en esta spec: `/health` lo consumen `infra/scripts/startup.ps1`, `backend/scripts/deploy.ps1` y el operador con `curl`. Una spec posterior de frontend puede mostrar el estado por broker en la página de Cuentas.

## Historias de usuario

- Como operador, quiero que `GET /health` liste cada broker configurado con el estado de su pipe y la antigüedad de su último tick y de su último sync de ficheros, para ver en una sola petición qué EA está caído sin abrir MT4 en el VPS.
- Como operador, quiero que un pipe cuyo `listen` falló se reintente con esperas crecientes, para que un error transitorio al arrancar no silencie un broker hasta el siguiente deploy.
- Como operador, quiero que los fallos silenciosos (`syncColors`, listado del directorio del bridge) aparezcan en el log de pm2 con el nombre del broker y el mensaje de error, para que una ruta de bridge rota sea visible el día que se rompe.

## Criterios de aceptación

- AC 1. CUANDO se llama a `GET /health` ENTONCES responde `200` con `{ status, uptimeS, brokers: [...] }` donde cada entrada de broker tiene `name`, `pipe` (`"listening" | "connected" | "error"`), `lastTickAt` (cadena ISO o `null`), `lastSyncAt` (cadena ISO o `null`) y `tickAgeS` / `syncAgeS` (segundos, o `null`). La ruta sigue sin autenticación.
- AC 2. CUANDO todos los brokers tienen el pipe conectado con un tick en los últimos 5 min ENTONCES `status` es `"ok"`; CUANDO al menos uno no ENTONCES `status` es `"degraded"`. El código HTTP es `200` en ambos casos (los scripts de deploy y arranque solo comprueban el 200).
- AC 3. CUANDO llega un lote de ticks, posiciones o cuenta por el pipe de un broker ENTONCES se actualiza el `lastTickAt` de ese broker; CUANDO el file watcher completa un poll (con independencia de fallos por paso) ENTONCES se actualiza `lastSyncAt`.
- AC 4. CUANDO el EA se conecta / desconecta del pipe ENTONCES `pipe` indica `"connected"` / `"listening"`; CUANDO `listen` falla ENTONCES `pipe` indica `"error"` y el servidor reintenta `listen` tras 1 s, doblando hasta 30 s, hasta que lo consigue (entonces `"listening"`), registrando cada intento con el nombre del broker y el mensaje de error.
- AC 5. CUANDO `syncColors` rechaza ENTONCES el error se registra una vez por rechazo con `[COLORS:<broker>]` y el mensaje; el broadcast de posiciones no se ve afectado.
- AC 6. CUANDO el watcher no puede listar el directorio del bridge ENTONCES la línea de log lleva el nombre del broker, la ruta y el mensaje de error (no el objeto de error serializado) y se emite como mucho una vez por minuto y broker mientras persista la condición.
- AC 7. CUANDO `FEATURE_PIPE=false` o `FEATURE_WATCHER=false` (desarrollo local) ENTONCES `/health` sigue listando los brokers, con `pipe: "disabled"` / `lastSyncAt: null`, y `status` es `"ok"` para las partes desactivadas (una feature desactivada no es un fallo).
- AC 8. CUANDO se despliega el backend ENTONCES `Wait-Health` de `deploy.ps1` y `Test-BackendHealth` de `startup.ps1` se comportan exactamente como antes (200 en el mismo tiempo) y la web no cambia.

## Fuera de alcance

- Mostrar el estado por broker en el frontend (spec de seguimiento candidata, capa frontend).
- Avisos (push/email) cuando un broker se queda obsoleto — `/health` es el gancho; el watchdog del VPS podría consultarlo más adelante.
- Lógica de reconexión en el lado del EA (el EA ya reconecta al pipe por su cuenta).
- Cambiar el intervalo de 30 s del watcher o el formato de mensajes del pipe.
