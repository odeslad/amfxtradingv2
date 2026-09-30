# 002 — Estadísticas por broker

## Contexto

El Journal muestra cuentas, posiciones abiertas y operaciones cerradas, pero no hay ningún sitio donde responder a "¿qué rendimiento tiene este broker?". El usuario quiere una sección Stats donde, tras elegir un broker y un periodo, pueda ver cuántas operaciones cierra ese broker al mes y cuánto ha crecido (o decrecido) la cuenta en porcentaje desde el inicio del periodo. Los datos ya existen en la tabla `trades` (operaciones BUY/SELL cerradas sincronizadas desde el EA) y en la tabla `balances` (un snapshot de balance por broker y día desde junio de 2026).

## Historias de usuario

- Como trader, quiero elegir un broker y un periodo y ver el número de operaciones cerradas por mes, para saber cuán activa es esa cuenta.
- Como trader, quiero ver el rendimiento porcentual del broker en el periodo seleccionado respecto al balance al inicio de ese periodo, para comparar cuentas en igualdad de condiciones independientemente de su tamaño.
- Como trader, quiero un pequeño conjunto de cifras de apoyo (P&L neto, ratio de acierto, número de operaciones) para el mismo periodo, para que el porcentaje tenga contexto.
- Como trader, quiero que la página de stats funcione en móvil, para consultar el rendimiento desde el teléfono como el resto de la app.

## Criterios de aceptación

1. Una nueva entrada `Stats` DEBERÁ aparecer en la barra lateral de escritorio y en la navegación inferior móvil, enrutada en `/stats` y protegida por auth como el resto de páginas.
2. La página DEBERÁ ofrecer un selector de broker (un solo broker, sin "todos") poblado con los brokers presentes en `balances`, y un selector de periodo con los mismos presets que el filtro de histórico del Journal (`All time`, `Today`, `Yesterday`, `Last week`, `Last month`, `Custom` con desde/hasta) más `This month`, `This year` y `Last 3 months`. El broker y el periodo seleccionados DEBERÁN persistir en localStorage.
3. CUANDO se seleccionen un broker y un periodo ENTONCES el backend DEBERÁ devolver, para las operaciones cerradas de ese broker cuyo `closeTime` caiga dentro del periodo: número total de operaciones, número de ganadoras y perdedoras (beneficio neto > 0 / < 0), P&L neto (profit + swap + commission) y un desglose por mes natural con número de operaciones y P&L neto para cada mes del periodo, incluidos los meses sin operaciones.
4. La página DEBERÁ mostrar las "operaciones por mes" como el total de operaciones dividido por el número de meses naturales que abarca el periodo (los meses parciales cuentan como uno), con un decimal.
5. El rendimiento porcentual DEBERÁ calcularse como `P&L neto del periodo / balance al inicio del periodo × 100`, donde el balance al inicio es el snapshot más reciente de `balances` para ese broker con `timestamp ≤ inicio del periodo`.
6. CUANDO no exista snapshot en o antes del inicio del periodo (periodo que empieza antes de junio de 2026, o `All time`) ENTONCES el balance inicial DEBERÁ derivarse como `balance actual − P&L neto de todas las operaciones cerradas desde el inicio del periodo`, y la página DEBERÁ mostrar un aviso visible de que la cifra asume que no hubo depósitos ni retiradas en el periodo.
7. CUANDO el balance inicial sea cero o no pueda determinarse ENTONCES el porcentaje DEBERÁ mostrarse como `—` en lugar de un número.
8. La página DEBERÁ mostrar como tiles principales: operaciones por mes, % de rendimiento, P&L neto en la divisa del broker, total de operaciones y ratio de acierto. Los valores positivos usan `--green` y los negativos `--red`, según el sistema de diseño.
9. El desglose mensual DEBERÁ renderizarse como tabla en escritorio y como cards en móvil (mismo patrón que el histórico del Journal), una fila por mes con etiqueta del mes, número de operaciones y P&L neto.
10. La respuesta para un broker sin operaciones en el periodo DEBERÁ ser un payload válido con contadores a cero, y la página DEBERÁ mostrar un estado vacío, no un error.
11. El endpoint DEBERÁ requerir auth y rechazar con 400 un broker ausente o desconocido.
12. `npm run build` DEBERÁ completarse en `backend/` y `frontend/` sin errores de TypeScript tras cada commit, y NO se añadirán dependencias nuevas.

## Fuera de alcance

- Comparar varios brokers lado a lado, o un agregado "todos los brokers".
- Curva de equity o cualquier gráfico. Una spec posterior puede añadirla una vez validadas las cifras.
- Incluir posiciones abiertas (P&L flotante) en las cifras. Las stats se basan solo en operaciones cerradas.
- Tener en cuenta depósitos y retiradas. El EA no exporta operaciones de balance, así que no están en la base de datos.
- Rellenar `balances` para fechas anteriores a junio de 2026.
- Desglose por símbolo o por estrategia.
- Cambios en el EA o en el bridge.
