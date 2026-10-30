# 033 — Presets de mirror · Diseño

## Enfoque

La configuración de mirror única (`settings_mirror`, una fila por broker) pasa a ser una lista de presets con nombre. Cada preset guarda su configuración por broker como JSON, validada con el mismo `parseMirror` de hoy. `/settings` devuelve y guarda `presets` en lugar de `mirror`, conservando el único botón Save de la página. New Trade elige un preset y construye las órdenes a partir de él exactamente como hoy a partir de `mirror` (`NewTradePanel.tsx:231`): los comandos al EA no cambian.

## Flujo de datos

```
settings_mirror (hoy) ──migración──▶ mirror_presets { "Default", brokers: [...] }
mirror_presets ──GET /settings (presets)──▶ Settings › Mirror (editar lista) ──PUT /settings (presets)──▶ mirror_presets
mirror_presets ──GET /settings──▶ New Trade: selector de preset ──▶ un comando por broker activo del preset (sin cambios)
```

Sin cambios en el contrato EA ↔ backend.

## Por capa

### db
- Modelo nuevo `MirrorPreset` → tabla `mirror_presets`: `id Int @id`, `name String @unique`, `position Int`, `brokers Json` (array de `{ broker, enabled, lotsMode, lots }`), `updatedAt`.
- Migración escrita a mano `20261030000000_mirror_presets`:
  1. `CREATE TABLE "mirror_presets"`.
  2. `INSERT` de un preset `Default`, posición 0, con `brokers` construido a partir de todas las filas de `settings_mirror` (`json_agg` ordenado por broker). Se inserta aunque `settings_mirror` esté vacía (`[]`), para que siempre exista un preset.
  3. `DROP TABLE "settings_mirror"` y quitar `SettingsMirror` de `schema.prisma`.

### backend (`src/routes/settings.ts`)
- GET: `presets: [{ id, name, brokers }]` ordenados por `position`; `mirror` desaparece de la respuesta.
- PUT: `presets` sustituye la lista entera en una transacción (borra los que no vienen, upsert del resto por `id`, `position` = índice en el array). Validación: array de 1 o más elementos, nombres únicos y no vacíos (recortados, máx. 40 caracteres), cada `brokers` pasa por `parseMirror`. Lista vacía → 400 (CA 9).
- Tests del parser: lista válida, lista vacía → 400, nombres duplicados → 400, elemento de broker inválido → 400.

### frontend
- **Settings › Mirror** (`MirrorTab.tsx`, `SettingsPage.tsx`):
  - Una fila de chips de presets encima de la tabla; el chip seleccionado es el preset que se edita. `+ New` añade un preset copiado del seleccionado (nombre "New preset"). El nombre se edita en un input; un botón `Delete` borra el preset seleccionado (desactivado cuando solo queda uno).
  - La tabla / cards de brokers de debajo son las de hoy, ligadas al preset seleccionado. Cada preset se combina con los brokers conectados (`/balances`) como hoy, así que un broker nuevo aparece desactivado.
  - Save envía `presets` con el resto de ajustes.
- **New Trade** (`NewTradePanel.tsx`):
  - En modo mirror, un selector `Preset` encima de la lista de brokers; la lista muestra los brokers activos y lotes del preset elegido. La selección se guarda en `localStorage` (`amfx.mirrorPreset`, por id de preset); si no existe, se usa el primer preset (CA 6, CA 7).
  - "No brokers enabled for mirror" pasa a referirse al preset elegido (CA 8); el botón Mirror sigue activo mientras algún preset tenga un broker activo.
  - Símbolos, en los dos modos (CA 10): filtrados con `isVisible(visibility, broker, symbol)` (`lib/visibility.ts`); en modo mirror un símbolo debe ser común y visible en todos los brokers activos del preset.
  - Símbolo por defecto (CA 11): el del gráfico si está en la lista; si no, `EURUSD` si está; si no, ninguno.
- Sin dependencias nuevas.

## Alternativas

- **Dos tablas relacionales** (`mirror_presets` + `mirror_preset_brokers`): esquema más estricto, pero el doble de migración y de código de upsert para una lista que siempre se lee y se escribe entera. Descartada; el JSON se valida en la ruta como hoy las filas.
- **Mantener `settings_mirror` como "por defecto" y añadir presets aparte**: dos sitios para configurar lo mismo. Descartada por el usuario en los requisitos.
- **Seguir devolviendo `mirror` por compatibilidad**: evita el hueco entre los despliegues del backend y del frontend, a costa de código muerto que habría que quitar después. Descartada: el hueco son minutos y solo afecta a New Trade y Settings hasta que se despliega el frontend.

## Riesgos

- **Hueco de despliegue**: entre el despliegue del backend y el del frontend, el frontend viejo lee `mirror` (que ya no existe), así que Settings › Mirror muestra "No brokers connected" y New Trade tiene el mirror desactivado. Desplegar el frontend justo después del backend; el trading manual sigue funcionando.
- **La migración borra `settings_mirror`**: sus datos se copian antes en la misma migración. `prisma migrate diff` contra producción debe seguir vacío.
- `localStorage` puede no estar disponible: se usa el primer preset.

## Maqueta

Aprobada el 2026-10-29: https://claude.ai/artifact/WKDKFYHu87AVkTXeArc8Jm

Vistas: escritorio Settings › Mirror editando un preset · móvil Settings › Mirror · Settings › Mirror con un solo preset (Delete desactivado) · escritorio New Trade en modo mirror · New Trade con un preset sin brokers activos · móvil New Trade en modo mirror.
