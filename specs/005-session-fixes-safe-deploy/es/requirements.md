# 005 — Arreglos de sesión y deploy seguro

> Estado: **borrador**
> Origen: [auditoría del backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejoras 2 y 3 (diagnósticos C y D)

## Contexto

Dos hallazgos independientes de la auditoría, ambos pequeños y confirmados. **Sesión:** `POST /auth/logout` llama a `res.clearCookie('token')` sin los atributos `domain`/`secure`/`sameSite` con los que se emitió la cookie, así que en producción la cookie de `.amfxtrading.com` sobrevive y al recargar la página el usuario vuelve a entrar (confirmado por el usuario); `POST /auth/login` admite intentos ilimitados y responde más rápido cuando el email no existe (se salta `bcrypt.compare`), lo que permite enumerar cuentas. **Deploy:** `deploy-backend.yml` no ejecuta ninguna comprobación en el runner de CI y va directo al SSH; en el VPS `deploy.ps1` para la app (`pm2 delete`) antes de instalar, migrar y compilar, `tsc` emite ficheros incluso con errores de tipos, `dist/` nunca se limpia, nada verifica `/health` tras `pm2 start`, y los flags de `pm2 start` están duplicados en `infra/scripts/startup.ps1`. Un fallo de build significa por tanto una caída hasta que alguien intervenga, con las migraciones ya aplicadas. Una restricción condiciona el arreglo: en Windows, `prisma generate` reescribe la DLL del query engine que el proceso en marcha mantiene bloqueada, así que la compilación completa con el cliente regenerado no puede ocurrir antes de parar la app — el gate previo a la parada tiene que vivir en CI, y el lado del VPS debe recuperarse ante fallo.

## Capas afectadas

- backend (ruta de auth, tsconfig, script de deploy, config de pm2)
- infra (workflow de GitHub Actions, script de arranque)

## Historias de usuario

- Como usuario, quiero que "Sign out" termine mi sesión, para que al recargar la página se pidan credenciales de nuevo.
- Como operador, quiero los intentos de login limitados y con tiempo neutro, para que el formulario no sirva para fuerza bruta ni para enumerar cuentas.
- Como operador, quiero que un push con código que no compila se rechace antes de tocar el servidor, para que un error nunca cause una caída.
- Como operador, quiero que un deploy que falla en el VPS deje la versión anterior en marcha e informe del fallo, para que producción siga arriba mientras lo arreglo.
- Como operador, quiero una única configuración de pm2 usada por el deploy y por el watchdog, para que los flags no puedan divergir.

## Criterios de aceptación

### Sesión

- AC 1. CUANDO se llama a `POST /auth/logout` ENTONCES la respuesta borra la cookie `token` con los mismos atributos `domain`, `path`, `secure` y `sameSite` usados en el login, y un `GET /auth/me` posterior con el mismo jar de cookies responde `401`.
- AC 2. CUANDO se llama a `POST /auth/login` con un email que no existe ENTONCES el servidor realiza igualmente una comparación bcrypt contra un hash ficticio fijo antes de responder `401`, de modo que el tiempo de respuesta no revela si el email existe.
- AC 3. CUANDO llegan más de 10 intentos fallidos de login para el mismo par `(IP del cliente, email)` en 15 minutos ENTONCES los siguientes intentos responden `429 { "error": "Too many attempts, try again later" }` hasta que expire la ventana; un login correcto reinicia el contador; el limitador vive en memoria del proceso (un reinicio lo borra).
- AC 4. CUANDO un login es válido ENTONCES el comportamiento no cambia (cookie, payload, caducidad de 7 días).

### Deploy

- AC 5. CUANDO un push toca `backend/**` ENTONCES un job de CI ejecuta `npm ci`, `prisma generate` y `tsc --noEmit` en el runner **antes** del job de deploy, y el job de deploy no se ejecuta si ese job falla.
- AC 6. CUANDO `tsc` reporta errores de tipos ENTONCES no se emite JavaScript (`noEmitOnError`).
- AC 7. CUANDO `deploy.ps1` compila ENTONCES compila en un directorio limpio (`dist.next`) y solo si tiene éxito lo intercambia por `dist/` (conservando el build anterior como `dist.prev`), de modo que `dist/` nunca contiene un build parcial ni ficheros huérfanos de fuentes borradas.
- AC 8. CUANDO cualquier paso posterior a `pm2 delete` falla (install, generate, migrate, build, start) ENTONCES el script reinicia el build anterior desde `dist.prev` (o `dist/` si el intercambio no había ocurrido), verifica `/health`, y sale con código distinto de cero con un mensaje que nombra el paso fallido y afirma que la versión anterior está en marcha.
- AC 9. CUANDO `pm2 start` tiene éxito ENTONCES el script sondea `http://localhost:3000/health` hasta 30 s y falla (con el rollback del AC 8) si nunca responde `200`.
- AC 10. CUANDO el backend lo arranca `deploy.ps1` o `startup.ps1` ENTONCES ambos usan el mismo `backend/ecosystem.config.js` (nombre, script, args de node, límite de memoria); los flags ya no aparecen inline en ninguno de los dos scripts.
- AC 11. CUANDO un deploy tiene éxito ENTONCES el resultado observable es el mismo que hoy: proceso pm2 `amfxtrading-backend` online, `pm2 save` hecho, `/health` 200, EAs reconectados.

## Fuera de alcance

- Comprobación de origen del WebSocket, heartbeat y entrega por usuario (mejora 5 de la auditoría).
- Cambiar la cookie a `SameSite=Lax` (posible porque app y API comparten el dominio registrable; se deja para la spec del WS, que revisa las suposiciones cross-site).
- Persistir el limitador de intentos (BD/Redis) — un solo usuario, en memoria basta.
- Pipeline de deploy del frontend (sin cambios; no para ningún servicio).
- Rollback de migraciones de BD — las migraciones siguen siendo aditivas; el build anterior se reinicia contra el esquema migrado, como ocurre hoy cuando se repite un deploy.
- `helmet`, límites de tamaño de cuerpo, endurecer la regex de CORS (mejora 9 de la auditoría / más adelante).
