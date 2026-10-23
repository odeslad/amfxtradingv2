# Deploy pipeline — EA

## Flujo general

```
push a master (ea/**)
        │
        ▼
GitHub Actions (ubuntu-latest)
        │
        │  SSH via Cloudflare Tunnel
        ▼
VPS Windows
   ├── C:\deploy\              ← staging
   │     ├── HttpBridgeCommands.mq4
   │     ├── HttpBridgeState.mq4
   │     ├── compile-ea.ps1
   │     └── distribute-ea.ps1
   │
   ├── compile-ea.ps1          ← metaeditor.exe compila → .ex4
   │
   └── distribute-ea.ps1       ← copia .mq4 + .ex4 a cada terminal MT4
```

## Steps del workflow (`.github/workflows/deploy-ea.yml`)

| Step | Qué hace |
|------|----------|
| Checkout | Descarga el repo |
| Install cloudflared | Instala el cliente de Cloudflare Tunnel en el runner |
| Setup SSH | Escribe la clave privada y configura el ProxyCommand con el service token de Cloudflare Access |
| Upload EA and scripts | SCP de los dos `.mq4` y los dos `.ps1` a `C:\deploy\` |
| Compile EA files | Ejecuta `compile-ea.ps1` en el VPS |
| Distribute to all MT4 instances | Ejecuta `distribute-ea.ps1` en el VPS |
| Reload the EA on every terminal | Ejecuta `restart-mt4.ps1` en el VPS: cierra cada terminal y la tarea `AMFX-Watchdog` lo relanza con el EA nuevo |

El workflow se dispara en push a `master` que toque `ea/**`, o manualmente con `workflow_dispatch`.

## Scripts PowerShell

### `ea/scripts/compile-ea.ps1`
Busca `metaeditor.exe` bajo `C:\Program Files (x86)\`, compila los dos `.mq4` de `C:\amfxtradingv2\ea\` (parámetro `-SourceDir` para otra carpeta) y produce los `.ex4` correspondientes. Muestra las líneas de error y el `Result:` del log de MetaEditor y **sale con 1** si algún fichero no produce un `.ex4` nuevo o el log acaba con errores, de modo que el workflow falla antes de distribuir. Ojo: el código de salida de MetaEditor no sirve de señal (devuelve 1 al compilar bien y 0 al fallar); la comprobación es el `.ex4` y el log.

### `ea/scripts/distribute-ea.ps1`
Itera todos los directorios bajo `C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\`. Para cada uno que tenga `MQL4\Experts\`, copia los `.mq4` y `.ex4` de `C:\deploy\`.

### `ea/scripts/restart-mt4.ps1`
Último paso del workflow. MT4 **no recarga** un EA cuando se sustituye su `.ex4` en disco (comprobado el 23-10-2026: los terminales siguieron con la versión cargada semanas antes), así que, terminal a terminal, el script cierra el proceso y lanza la tarea programada `AMFX-Watchdog` (`infra/scripts/startup.ps1`, ejecutada como el Administrator con sesión abierta) para que lo arranque de nuevo en la sesión interactiva; espera a que vuelva (hasta 120 s) antes de pasar al siguiente, así cada broker está sin terminal unos 20–30 s y nunca se paran todos a la vez. Sale con 1 si alguno no vuelve. **Nunca** arrancar `terminal.exe` con `Start-Process` desde SSH: queda en la sesión 0, invisible, y muere.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\amfxtradingv2\ea\scripts\restart-mt4.ps1"
```

## Infraestructura de red

- **Túnel:** Cloudflare Tunnel `amfxtrading-v2` (ID `fb1c65c3-9f0b-4aae-ada6-69b794760ee0`), gestionado localmente desde `C:\Users\Administrator\.cloudflared\config.yml`
- **Hostname SSH:** `ssh-v2.amfxtrading.com` (subdominio de un nivel — los de dos niveles no están cubiertos por el wildcard SSL de Cloudflare)
- **Auth:** Cloudflare Access app "VPS SSH" (self-hosted), política Service Auth con el service token `github-actions`
- **Secrets GitHub:** `SSH_PRIVATE_KEY`, `SSH_USER`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`

## Configuración por terminal (`bridge/config.json`)

Cada terminal MT4 puede tener su propia configuración en:

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\<HASH>\MQL4\Files\bridge\config.json
```

```json
{
  "brokerName": "solidary",
  "symbols": "EURUSD,EURGBP,EURJPY,..."
}
```

Si el archivo existe, sobreescribe los inputs del EA. Si no existe, el EA usa `AccountCompany()` como fallback para `brokerName` y el input `SYMBOLS`.

Ver `ea/config.example.json` como referencia.

## Recarga del EA en MT4

MT4 no recarga el EA de los charts activos al cambiar el `.ex4`, por eso el workflow termina con `restart-mt4.ps1` (ver arriba). Si hiciera falta recargar a mano un solo terminal: en MT4, clic derecho sobre el EA en el chart → **Remove** y arrastrarlo de nuevo desde el Navigator, o cerrar ese terminal y lanzar la tarea `AMFX-Watchdog` (`schtasks /run /tn AMFX-Watchdog`) para que lo arranque en la sesión interactiva. Comprobación: la línea `[CMD] HttpBridgeCommands v<versión> | broker: …` en `…\Terminal\<id>\MQL4\Logs\<fecha>.log` y los pipes en `/health`.
