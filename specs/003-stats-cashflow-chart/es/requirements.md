# 003 — Stats: rendimiento mensual, flujo de caja y gráfico de balance

## Contexto

La spec 002 entregó una página Stats cuyo rendimiento divide el P&L de operaciones del periodo entre un balance inicial que es o bien un snapshot diario o bien un cálculo hacia atrás desde el balance actual. Ambos ignoran depósitos y retiros porque el EA solo exporta órdenes BUY/SELL, así que un depósito dentro del periodo aparece como beneficio. El usuario también quiere un porcentaje de rendimiento por mes en la tabla de desglose y una visual de cómo evolucionó el balance en el periodo. Esta spec cierra esas tres carencias: el EA exporta las operaciones de balance, el backend las almacena y las usa en todos los rendimientos, y la página gana un gráfico de balance junto a la tabla mensual.

## Historias de usuario

- Como trader, quiero que se tengan en cuenta depósitos, retiros y ajustes de balance para que el porcentaje de rendimiento refleje la operativa y no el dinero que he movido.
- Como trader, quiero que cada mes del desglose muestre su propio porcentaje de rendimiento para comparar meses independientemente del tamaño de la cuenta en ese momento.
- Como trader, quiero ver la curva de balance del periodo seleccionado junto a la tabla mensual para detectar drawdowns y crecimiento de un vistazo.

## Criterios de aceptación

### EA

1. `history.json` DEBERÁ incluir órdenes de tipo `OP_BALANCE` (6) y `OP_CREDIT` (7) además de BUY/SELL, con los mismos campos que hoy; en estas órdenes `symbol` va vacío, `lots`/precios a `0`, `profit` lleva el importe con signo y `comment` la etiqueta del broker (p. ej. `Deposit`, `Withdrawal`).
2. El tope `HISTORY_MAX` y la exportación completa `HISTORY_FULL_ON_START` DEBERÁN aplicarse a la lista combinada, de más reciente a más antigua, exactamente como hoy con las operaciones.

### Backend — persistencia

3. Un nuevo modelo Prisma `BalanceOperation` (tabla `balance_operations`) DEBERÁ almacenar: `ticket` (PK), `broker`, `type` (6 o 7), `amount` (con signo, desde `profit`), `comment`, `time` (desde `closeTime`), indexado por `(broker, time)`.
4. CUANDO el file watcher emita un lote de history ENTONCES el backend DEBERÁ hacer upsert de las entradas BUY/SELL en `trades` y de las de tipo 6/7 en `balance_operations`, sin mezclarlas, y los tickets existentes DEBERÁN quedar intactos.
5. Una migración DEBERÁ crear la tabla sin alterar `trades`.

### Backend — `GET /stats`

6. El **balance en cualquier instante** DEBERÁ reconstruirse como `último snapshot de balance − Σ P&L neto de operaciones cerradas después de ese instante − Σ operaciones de balance posteriores a ese instante`. Se eliminan la búsqueda de snapshot en `balances` y el campo `startBalanceSource`; el aviso de derivado desaparece de la página.
7. El rendimiento del periodo DEBERÁ ser `netPnl / (balance al inicio del periodo + depósitos − retiros del periodo) × 100`, donde los depósitos son operaciones de balance positivas y los retiros negativas. CUANDO el denominador sea `≤ 0` ENTONCES `returnPct` DEBERÁ ser `null`.
8. Cada entrada de `monthly` DEBERÁ llevar además `cashFlow` (Σ operaciones de balance de ese mes, con signo) y `returnPct` calculado con la misma regla que en 7 usando el balance al inicio de ese mes.
9. La respuesta DEBERÁ incluir `cashFlow` de todo el periodo y un array `curve` con un punto por día natural desde el inicio del periodo (o primera operación) hasta el fin del periodo (u hoy): `{ date: 'YYYY-MM-DD', balance: number }`, donde `balance` es el balance reconstruido al final de ese día.
10. La respuesta DEBERÁ incluir también `operations`: las operaciones de balance dentro del periodo, `{ time, amount, comment }`, de más reciente a más antigua, para que la página las marque en el gráfico.
11. CUANDO el broker no tenga operaciones de balance en la base de datos ENTONCES todas las cifras DEBERÁN coincidir con el comportamiento actual de 002 con balance inicial derivado (flujo de caja `0`).

### Frontend

12. El desglose mensual DEBERÁ añadir una columna **Return** (`+x.xx %` / `—`, coloreada por signo) y una columna **Cash flow** (importe con signo en la divisa del broker, `—` cuando sea `0`). Las cards móviles DEBERÁN mostrar las mismas dos cifras.
13. El tile `Return` DEBERÁ usar el nuevo `returnPct` del periodo; se elimina el aviso de derivado. Un nuevo tile **Cash flow** DEBERÁ mostrar los depósitos/retiros netos del periodo.
14. Bajo los tiles, en escritorio (`min-width: 769px`) la página DEBERÁ mostrar el desglose mensual en la mitad izquierda y un gráfico de balance en la mitad derecha, cada uno al 50 % del ancho. En móvil se apilan, gráfico primero.
15. El gráfico de balance DEBERÁ renderizar `curve` como una línea en la divisa del broker usando la librería `lightweight-charts` ya presente en el proyecto, con los colores del sistema de diseño, un tooltip de crosshair con fecha y balance, y un marcador en cada operación de balance etiquetado con su importe con signo.
16. CUANDO no haya operaciones en el periodo ENTONCES el área del gráfico DEBERÁ mostrar el mismo estado vacío que la tabla.
17. `npm run build` DEBERÁ completarse en `backend/` y `frontend/` tras cada commit; NO se añadirán dependencias nuevas.

## Fuera de alcance

- Rendimiento ponderado por tiempo (encadenar subperiodos entre flujos de caja). La fórmula elegida trata el flujo de caja como capital añadido al inicio del periodo.
- P&L flotante de posiciones abiertas en la curva de balance; la curva es balance, no equity.
- Rellenar operaciones de balance que MT4 ya no muestre en Account History.
- Cambiar cómo se escriben los snapshots diarios de `balances`; siguen siendo el ancla del "último balance".
- Cambiar la vista History del Journal para mostrar operaciones de balance.
