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

El workflow se dispara en push a `master` que toque `ea/**`, o manualmente con `workflow_dispatch`.

## Scripts PowerShell

### `ea/scripts/compile-ea.ps1`
Busca `metaeditor.exe` bajo `C:\Program Files (x86)\`, compila los dos `.mq4` en `C:\deploy\` y produce los `.ex4` correspondientes.

### `ea/scripts/distribute-ea.ps1`
Itera todos los directorios bajo `C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\`. Para cada uno que tenga `MQL4\Experts\`, copia los `.mq4` y `.ex4` de `C:\deploy\`.

### `ea/scripts/restart-mt4.ps1`
Script manual (no integrado en CI). Para cada proceso `terminal.exe` en ejecución: lo para, espera 3 segundos y lo reinicia. Ejecutar en el VPS cuando se quiera aplicar los cambios sin recargar el EA a mano en el chart.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\deploy\restart-mt4.ps1"
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

## Restart manual del EA en MT4

El deploy copia los archivos compilados pero **no recarga el EA** en los charts activos. Para aplicar los cambios:

1. En MT4, clic derecho sobre el EA en el chart → **Remove**
2. Arrastrar el EA de nuevo desde el Navigator
3. O usar `restart-mt4.ps1` para reiniciar el proceso completo (solo fuera de mercado o sin posiciones activas)
