# 031 — Recarga fiable del EA tras el despliegue

> Estado: **cerrada**

## Contexto
El pipeline del EA (`.github/workflows/deploy-ea.yml`) termina con `ea/scripts/restart-mt4.ps1`, que recarga el EA en cada terminal MT4: para un terminal, lanza la tarea programada AMFX-Watchdog (`infra/scripts/startup.ps1`) para que lo vuelva a arrancar en la sesión interactiva y espera hasta 120 s. La tarea está configurada con `MultipleInstances = IgnoreNew` y cada ejecución del Watchdog tarda (comprobación de salud del backend, una pausa entre terminales), así que un `/run` lanzado mientras la anterior sigue en marcha se ignora en silencio y el terminal solo vuelve en una ejecución posterior. En el run #41 (spec 030, EA 3.15) 6 de 12 terminales salieron como `[FAILED]`, el propio script imprimió `Terminals running: 12/12`, el job terminó igualmente con exit 1 (rojo) y la recarga completa tardó ~15 min.

## Capas afectadas
- infra (`ea/scripts/restart-mt4.ps1`, y `deploy-ea.yml` solo si el paso necesita un timeout nuevo)

## Historias de usuario
- Como operador, quiero que el despliegue del EA salga en verde cuando todos los terminales acaban corriendo el EA nuevo, para que un run en rojo signifique un problema real.
- Como operador, quiero que la recarga tarde lo menos posible, para que los terminales estén el menor tiempo sin EA.

## Criterios de aceptación
- CA 1. CUANDO el script pide a AMFX-Watchdog arrancar terminales ENTONCES nunca lanza `/run` mientras la tarea ya está en marcha (antes espera a que esté libre), así que ninguna petición se ignora en silencio.
- CA 2. CUANDO todos los terminales que corrían al principio vuelven a correr al final, en la sesión interactiva (sesión ≠ 0) ENTONCES el script sale con 0, aunque alguno haya tardado más de lo esperado.
- CA 3. CUANDO un terminal que corría al principio no está en marcha al agotarse el timeout global ENTONCES el script indica cuáles faltan y sale con 1.
- CA 4. Un terminal que tarda en volver se registra como aviso, no como `[FAILED]`.
- CA 5. Una recarga completa de los 12 terminales tarda claramente menos que los ~15 min actuales (objetivo: menos de ~6 min).
- CA 6. El script sigue sin arrancar nunca `terminal.exe` él mismo desde la sesión SSH (sesión 0); solo AMFX-Watchdog arranca terminales.
- CA 7. CUANDO no hay ningún terminal en marcha al principio ENTONCES el comportamiento no cambia: pide a AMFX-Watchdog que los arranque y sale con 0.

## Fuera de alcance
- Cambiar `infra/scripts/startup.ps1` o la configuración de la tarea AMFX-Watchdog.
- Cambiar el propio EA o los pasos de compilación/distribución del pipeline.
- Recargar el EA sin reiniciar el terminal.
