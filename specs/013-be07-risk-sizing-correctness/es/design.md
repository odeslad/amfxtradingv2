# 013 · BE-07 — Corrección del sizing por % de riesgo · Diseño

## Enfoque

`services/sizing.ts` sigue siendo un módulo puro pero deja de adivinar. `calculateLots` recibe un objeto de opciones y devuelve un resultado discriminado — los lotes, o el motivo por el que se niega — en vez de un número a secas. `routes/commands.ts` traduce la negativa a la respuesta HTTP (400 o 503) con la misma forma `{ error }` que la ruta ya usa en sus otros 400/503, antes del 202 y antes de encolar nada. Sin cambios de middleware: la ruta responde directamente, como hace hoy con "SL is required" y "Account data not available yet".

Sin dependencias nuevas.

## Cambios por capa

### backend

**1. `src/services/sizing.ts`**

```ts
export interface SizingInput {
  balance: number;
  riskPct: number;
  entryPrice: number;        // precio de una orden pendiente, si no el bid actual
  slPrice: number;
  symbol: string;
  accountCurrency: string;
  bids: Map<string, number>;
}

export type SizingResult =
  | { ok: true; lots: number }
  | { ok: false; reason: 'not_forex' | 'zero_stop' | 'no_conversion'; error: string };

export function calculateLots(input: SizingInput): SizingResult
```

- `pair = symbol.toUpperCase().slice(0, 6)`; `base = pair.slice(0, 3)`, `quote = pair.slice(3, 6)`. Ambas deben estar en `CURRENCIES` (`USD EUR GBP JPY CHF CAD AUD NZD` — las ocho divisas detrás de todos los pares de `indicators/pip-size.ts`) y el símbolo tener al menos 6 caracteres; si no, `not_forex` → `Risk % sizing supports forex pairs only (got <SYMBOL>); use fixed lots`.
- `pipSize = getPipSize(pair)` (tabla compartida; los pares desconocidos caen ahí a 0,0001, y una cotizada JPY fuera de la tabla se cubre añadiendo la regla `quote === 'JPY' → 0.01` dentro de `getPipSize` para que ambos llamadores coincidan).
- `slPips = |entryPrice − slPrice| / pipSize`; `0` → `zero_stop` → `SL must differ from the entry price`.
- Valor del pip por lote = `pipSize × 100 000` en la divisa cotizada; conversión a la divisa de la cuenta: misma divisa → tal cual; `bids.get(quote+account)` → multiplicar; `bids.get(account+quote)` → dividir; ninguno → `no_conversion` → `Cannot size <SYMBOL> on a <ACC> account: no <QUOTE><ACC> or <ACC><QUOTE> price yet`. La búsqueda prueba primero la clave exacta de 6 letras y después cualquier símbolo recibido que empiece por ella, de modo que un sufijo de broker en el par de conversión (`EURJPY.r`) también resuelve.
- `lots = max(0.01, round2(balance × riskPct / 100 / (slPips × pipValue)))` — fórmula sin cambios.

**2. `src/routes/commands.ts`**

```ts
const sized = calculateLots({ balance: account.balance, riskPct: rawLots, entryPrice: price ?? bid, slPrice: sl, symbol, accountCurrency: account.currency, bids: allBids });
if (!sized.ok) {
  res.status(sized.reason === 'no_conversion' ? 503 : 400).json({ error: sized.error });
  return;
}
lots = sized.lots;
```

`bid` sigue siendo obligatorio en órdenes a mercado (503 existente "Tick data not available yet for this symbol"); en una orden pendiente con `price` el bid ya no hace falta para la distancia, pero la comprobación se mantiene (un símbolo sin ticks es un símbolo que el EA no está enviando — mandar una orden sobre él es sospechoso de todos modos).

**3. `src/indicators/pip-size.ts`**: `getPipSize` devuelve `0.01` para cualquier símbolo cuya divisa cotizada (letras 4–6) sea `JPY` cuando el símbolo no está en la tabla, `0.0001` en otro caso. Las entradas de la tabla no cambian, así que scanner, alertas y setup levels conservan sus valores.

**4. Tests**

- `services/sizing.test.ts` reescrito para la nueva firma: los cinco casos que no deben cambiar (misma divisa 0,5; USDJPY vía inverso 0,75; cuenta EUR vía inverso 0,5; GBPJPY vía directo 0,3; suelo y redondeo) conservan sus números; el caso "fallback a valor de pip sin convertir" pasa a `no_conversion` con su mensaje; stop cero → `zero_stop`; nuevos: orden pendiente dimensionada desde `entryPrice` (mismas entradas que el caso a mercado pero otra entrada → otros lotes, calculados a mano), `XAUUSD` / `US30` / `BTCUSD` → `not_forex`, `EURUSD.r` dimensionado como `EURUSD`, par de conversión encontrado bajo una clave con sufijo.
- `indicators/pip-size.test.ts` (nuevo, pequeño): valores de la tabla, regla JPY para un par no listado, valor por defecto.

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/src/services/sizing.ts` | objeto de opciones, tipo de resultado, negativas explícitas, pip compartido |
| `backend/src/services/sizing.test.ts` | reescrito |
| `backend/src/indicators/pip-size.ts` | regla JPY para pares no listados |
| `backend/src/indicators/pip-size.test.ts` | nuevo |
| `backend/src/routes/commands.ts` | llamada, mapeo 400/503, `price ?? bid` |

## Riesgos

- **Cambio de comportamiento por diseño**: órdenes que hoy salen con un tamaño erróneo ahora se rechazan. Un usuario con cuenta EUR que opere un cruce JPY con % de riesgo necesita `EURJPY` (o `JPYEUR`) con ticks en el EA de ese broker; si no está en la lista de símbolos del EA la orden se rechaza con los nombres de par en el mensaje — la solución es añadir el símbolo al EA o usar lotes fijos.
- El cambio de `getPipSize` solo afecta a símbolos fuera de la tabla; todo par listado conserva su valor (cubierto por el test nuevo).
- La lista de 8 divisas rechaza pares forex exóticos (p. ej. `USDMXN`, `EURTRY`) con % de riesgo; antes se dimensionaban con pip 0,0001 y valor sin convertir, es decir, mal. Ampliar la lista es un cambio de una línea cuando haga falta.
