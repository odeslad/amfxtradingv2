# 006 — Números de build en el footer · Diseño

> Estado: **aprobada**

## Enfoque

Tres piezas pequeñas, sin dependencias nuevas:

1. **Constante del frontend** — `vite.config.ts` ejecuta `git rev-list --count HEAD -- frontend` (vía `child_process.execSync`, cwd = raíz del repo) y lo expone como `__BUILD_FRONTEND__` mediante `define`. Una declaración en `src/vite-env.d.ts` lo tipa como `number`. Fallo → `0` + `console.warn`.
2. **`/version` del backend** — `src/version.ts` calcula `{ backend, ea }` una vez al importar con el mismo comando para `backend` y `ea`, cwd = `path.resolve(__dirname, '..', '..')` (raíz del repo desde `dist/` o `src/`). Fallo → `0` + `console.warn('[VERSION] …')`. `app.ts` monta `app.get('/version', …)` junto a `/health`, antes de los routers con `requireAuth`.
3. **Footer** — `AppLayout` incorpora un hook `useBuildInfo()` (`src/lib/useBuildInfo.ts`) que hace fetch de `/version` una vez al montar y devuelve `{ frontend, backend, ea }` con `backend`/`ea` como `number | null`; el footer renderiza `build: {frontend}.{backend ?? '?'}.{ea ?? '?'}` en `--font-mono` dentro del `.footer` existente.

Alternativas consideradas:

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| **Recuento de commits por directorio** | automático, por capa, ya disponible en el VPS | número del EA = checkout, no lo que cargó MT4 | **elegida** (fuera de alcance anotado) |
| Número de ejecución de GitHub Actions | trivial en CI | un contador por workflow, no por capa; no disponible para el build del backend en el VPS | descartada |
| `version.json` manual por capa | explícito | se olvida incrementar; contradice "autoincremental" | descartada |
| El backend calcula los tres (frontend incluido) | una sola fuente | el frontend debe mostrar lo que *es*, no lo que dice el checkout; un bundle cacheado mentiría | descartada |

## Frontend

```ts
// vite.config.ts
import { execSync } from 'child_process';

function gitCount(dir: string): number {
  try { return Number(execSync(`git rev-list --count HEAD -- ${dir}`, { cwd: '..', stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) || 0; }
  catch { console.warn(`[build] git count for ${dir} unavailable, using 0`); return 0; }
}

export default defineConfig(({ command }) => ({
  define: { __BUILD_FRONTEND__: JSON.stringify(gitCount('frontend')) },
  ...
```

`cwd: '..'` porque Vite corre desde `frontend/`; el recuento debe incluir los commits bajo `frontend/` (el script de deploy ejecuta `npm run build` en `frontend/`, misma disposición).

```ts
// src/lib/useBuildInfo.ts
interface BuildInfo { frontend: number; backend: number | null; ea: number | null }
export function useBuildInfo(): BuildInfo  // fetch(apiUrl('/version')) al montar, sin credenciales
```

Markup del footer (`AppLayout.tsx`):

```tsx
<footer className={styles.footer}>
  AMFX Trading Terminal v2.0 &nbsp;·&nbsp; © {new Date().getFullYear()} &nbsp;·&nbsp;
  <span className={styles.build}>build: {build.frontend}.{build.backend ?? '?'}.{build.ea ?? '?'}</span>
</footer>
```

`.build { font-family: var(--font-mono); margin-left: 4px; }` — mismo tamaño/color que el footer. Regla móvil sin cambios (footer oculto).

## Backend

```ts
// src/version.ts
import { execSync } from 'child_process';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function gitCount(dir: string): number { /* igual que arriba, cwd: REPO_ROOT, prefijo de aviso [VERSION] */ }

export const version = { backend: gitCount('backend'), ea: gitCount('ea') };
```

`app.ts`: `app.get('/version', (_req, res) => res.json(version));` justo después de `/health`. Calculado al cargar el módulo, así que un deploy (reinicio del proceso) lo refresca; sin llamada a git por petición.

Nota de desarrollo: el backend local corre desde `src/` con `tsx`, y desde `dist/` en producción — ambos están dos niveles por debajo de la raíz del repo, así que `REPO_ROOT` resuelve igual.

## Flujo de datos

Navegador → `GET /version` (sin cookie) → `{ backend, ea }`. Sin cambios en EA ni WS.

## Archivos a tocar

- `frontend/vite.config.ts`, `frontend/src/vite-env.d.ts` (declarar `__BUILD_FRONTEND__`), `frontend/src/lib/useBuildInfo.ts` (nuevo), `frontend/src/app/layout/AppLayout.tsx`, `AppLayout.module.css`
- `backend/src/version.ts` (nuevo), `backend/src/app.ts`

## Riesgos

- **Un clon superficial en el VPS** contaría de menos. El VPS hace pull sobre un clon completo (`git pull origin master` en un checkout existente); CI no construye el frontend. Si algún día aparece un clon superficial, los números bajan — visible al instante en el footer.
- **`/version` sin autenticación** expone dos enteros; aceptable (igual que `/health`).
- **Tipado de `define`**: `__BUILD_FRONTEND__` debe declararse o `tsc` rompe el build del frontend — cubierto por `vite-env.d.ts`.
