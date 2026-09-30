# 005 — Arreglos de sesión y deploy seguro · Diseño

> Estado: **aprobada**

## Parte A — Sesión (`backend/src/routes/auth.ts`)

### A.1 Logout

```ts
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'none' as const, domain: config.cookieDomain, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
const { maxAge: _maxAge, ...CLEAR_COOKIE_OPTIONS } = COOKIE_OPTIONS;

router.post('/logout', (_req, res) => {
  res.clearCookie('token', CLEAR_COOKIE_OPTIONS);
  res.json({ ok: true });
});
```

`path: '/'` es el valor por defecto de Express en `res.cookie`, hecho explícito para que ambas llamadas coincidan. Con `COOKIE_DOMAIN=none` (local) `domain` es `undefined` en ambas, sin cambios.

### A.2 Login con tiempo neutro

```ts
// hash bcrypt de una cadena aleatoria, coste 12 — mismo trabajo que una comparación real.
const DUMMY_HASH = '$2b$12$…';   // generado una vez con bcrypt.hash(randomBytes(32).toString('hex'), 12)

const user = await db.user.findUnique({ where: { email } });
const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !valid) { … 401 'Invalid credentials' }
```

Una comparación en ambas ramas. El hash ficticio es una constante del fichero (no es un secreto: hashea una cadena desechable que nadie conoce).

### A.3 Límite de intentos de login — `backend/src/middleware/loginLimiter.ts`

En memoria, sin dependencia:

```ts
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; first: number }>();   // clave = `${ip}|${email}`

export function loginKey(req: Request, email: string): string   // ip desde req.ip (trust proxy activado, ver abajo)
export function isBlocked(key: string): boolean                 // count >= MAX y dentro de la ventana → true; expirado → delete, false
export function recordFailure(key: string): void
export function clearFailures(key: string): void
```

Se usa dentro del handler de `/login` (no como middleware del router, porque la clave necesita el `email` parseado): `if (isBlocked(key)) → 429 { error, message: 'Too many attempts, try again later' }`; tras un 401 → `recordFailure`; tras éxito → `clearFailures`. Un `setInterval` (con `unref`) barre las entradas expiradas cada 5 min para que el mapa no crezca sin límite.

**`req.ip` detrás de Cloudflare + nginx**: hoy `app` no tiene `trust proxy`, así que `req.ip` es la dirección de nginx para todos los clientes — el limitador lo pondría todo bajo una IP. Añadir `app.set('trust proxy', 1)` en `app.ts` para que `req.ip` lea el último salto de `X-Forwarded-For` (nginx lo pone desde Cloudflare, que a su vez trae el cliente real). Efecto en el resto: ninguno (nada más lee `req.ip`; las cookies `secure` se ponen incondicionalmente).

### A.4 Claves de respuesta

El `429` lleva `error` y `message`, como las respuestas `BadRequest` de la spec 004, para que `AuthContext` (lee `message`) muestre el texto.

## Parte B — Deploy

### B.1 Gate en CI — `.github/workflows/deploy-backend.yml`

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit
  deploy:
    needs: check
    runs-on: ubuntu-latest
    steps: (sin cambios: cloudflared, ssh, scp deploy.ps1, ejecutarlo)
```

`prisma generate` en el runner no necesita base de datos (`DATABASE_URL` solo se lee en runtime); el esquema ya declara `debian-openssl-3.0.x` como binary target. `workflow_dispatch` sigue funcionando (`check` corre primero).

### B.2 `tsconfig.json`

`"noEmitOnError": true`. `outDir` sigue siendo `dist`; el deploy lo sobreescribe por build (B.3).

### B.3 `backend/ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'amfxtrading-backend',
    script: 'C:/amfxtradingv2/backend/dist/index.js',
    node_args: '--expose-gc --max-old-space-size=1024',
    max_memory_restart: '1200M',
  }],
};
```

`deploy.ps1` → `pm2 start C:\amfxtradingv2\backend\ecosystem.config.js`; `startup.ps1` → lo mismo, sustituyendo sus flags inline (`infra/scripts/startup.ps1:56-58`). `pm2 delete amfxtrading-backend` sigue por nombre.

### B.4 `backend/scripts/deploy.ps1` — orden y rollback

```
git reset/clean/pull                              (como hoy)
pm2 delete (tolerante) · liberar puerto 3000      (como hoy — debe preceder a npm install: bloqueo de la DLL de Prisma)
$rollbackReady = Test-Path dist\index.js          (¿hay build anterior?)
try {
  npm install
  prisma generate
  prisma migrate deploy
  Remove-Item dist.next -Recurse -Force -EA SilentlyContinue
  npx tsc --outDir dist.next                      (noEmitOnError → nada si falla)
  if (Test-Path dist.prev) Remove-Item dist.prev -Recurse -Force
  if (Test-Path dist)      Rename-Item dist dist.prev
  Rename-Item dist.next dist
  pm2 start ecosystem.config.js
  Wait-Health 30s  → throw "health check failed" si nunca 200
  pm2 save
  "[OK] Backend deployed and running"
} catch {
  Write-Host "[FAILED] step: $step — $_"
  if (-not (Test-Path dist\index.js) -and (Test-Path dist.prev)) { devolver dist.prev a dist }
  if ($rollbackReady) {
    pm2 delete (tolerante); pm2 start ecosystem.config.js
    if (Wait-Health 30s) { "[ROLLBACK] previous build is running" } else { "[ROLLBACK FAILED] backend is DOWN" }
  }
  exit 1
}
```

`Invoke-Step` sigue fijando `$step` antes de cada comando para que el mensaje de fallo lo nombre (AC 8). `Wait-Health` sondea `http://localhost:3000/health` cada 2 s (AC 9). `dist.prev` se conserva hasta el siguiente deploy (una generación de rollback). Como `prisma migrate deploy` corre antes del build, un rollback ejecuta el build anterior contra el esquema migrado — aceptable según los requisitos (migraciones aditivas; idéntico a repetir el script de hoy).

Lo que **no** se mueve: `pm2 delete` antes de `npm install` — el bloqueo de la DLL del query engine de Prisma es real en Windows (documentado en el script). La ventana de parada sigue existiendo (install + generate + migrate + build ≈ 1–2 min), pero ya no puede terminar en caída: o el build nuevo está sano o el anterior vuelve.

### B.5 `infra/scripts/startup.ps1`

Sustituir el `pm2 start … --node-args … --max-memory-restart` inline por `pm2 start C:\amfxtradingv2\backend\ecosystem.config.js`. `$BackendEntry` deja de usarse → eliminado.

## Archivos a tocar

- backend: `src/routes/auth.ts`, `src/middleware/loginLimiter.ts` (nuevo), `src/app.ts` (`trust proxy`), `tsconfig.json`, `ecosystem.config.js` (nuevo), `scripts/deploy.ps1`
- infra: `.github/workflows/deploy-backend.yml`, `infra/scripts/startup.ps1`

## Estrategia de verificación

- A: secuencia `curl` en local (login → `/me` 200 → logout → `/me` 401 con el mismo jar de cookies); 11 contraseñas erróneas → 429; comprobación de tiempos con `curl -w %{time_total}` en un email desconocido vs uno conocido (mismo orden de magnitud).
- B: el gate de CI no se puede ejercitar con una rama desechable (los workflows corren solo en `master`). En su lugar: ejecutar el equivalente local del job `check` (`npm ci && npx prisma generate && npx tsc --noEmit` en un clon limpio) y, para el gate real, verificar en el primer push que la UI de Actions muestra `check` → `deploy`. Camino de rollback: probado **en el VPS con `workflow_dispatch`** tras inyectar un paso fallido mediante una variable de entorno que el script solo respeta cuando está definida (`AMFX_DEPLOY_FAIL_AT=build`), y después un dispatch normal; ambos resultados comprobados con `pm2 jlist` y `/health`.

## Riesgos

- Un `trust proxy` mal configurado haría que `req.ip` fuera la cabecera aportada por el cliente → limitador evitable; como la clave incluye también el email, el peor caso es el comportamiento de hoy (sin límite por IP). Verificado en producción registrando `req.ip` una vez en el login (eliminado tras la comprobación).
- Que el propio rollback falle (p. ej. `dist.prev` ausente en la primera ejecución): el script lo dice explícitamente (`[ROLLBACK FAILED]`), el watchdog sigue intentando `pm2 resurrect` como hoy.
- `dist.prev` duplica el disco de `dist` (~pocos MB): despreciable.
- El gancho `AMFX_DEPLOY_FAIL_AT` debe ser imposible de disparar por accidente: solo se lee del entorno de la sesión SSH, nunca se define en el workflow.
