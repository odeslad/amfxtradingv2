#property copyright "HttpBridge"
#property version   "3.14"
#property strict

#import "kernel32.dll"
   int  CreateFileW(string name, int access, int share, int security, int creation, int flags, int htemplate);
   bool WriteFile(int handle, uchar &buf[], int toWrite, int &written[], int &ovlp[]);
   bool CloseHandle(int handle);
   int  CreateEventW(int security, int manualReset, int initialState, int name);
   int  WaitForSingleObject(int handle, uint ms);
   bool CancelIo(int handle);
   bool ResetEvent(int handle);
#import

input string BROKER_NAME   = "ftmo";
input string SYMBOLS       = "EURUSD,EURGBP,EURJPY,EURCAD,EURAUD,GBPUSD,GBPJPY,GBPCAD,GBPAUD,USDJPY,USDCAD,AUDUSD,AUDJPY,AUDCAD,CADJPY";
input int    RECENT_BARS   = 100;
input int    STATE_EVERY_S = 60;         // seconds between state updates (history, candles).
input int    POSITIONS_EVERY_S = 1;      // seconds between live position pushes over the pipe.
input int    ACCOUNT_EVERY_S = 1;        // seconds between live account pushes over the pipe.

// ── Runtime config (config.json overrides inputs) ────────────────────────────
string g_brokerName  = "";
string g_symbolsRaw  = "";

// ── Pipe state ──────────────────────────────────────────────────────────────
string g_pipeName     = "";
int    g_pipe         = INVALID_HANDLE;
int    g_event        = INVALID_HANDLE;
int    g_ovlp[5];
int    g_timeouts     = 0;

// ── Timer state ──────────────────────────────────────────────────────────────
ulong  lastStateSend      = 0;
ulong  lastPositionsSend  = 0;
ulong  lastAccountSend    = 0;
int    g_lastPositionCount = -1;

// ── Symbol list ──────────────────────────────────────────────────────────────
string g_symbols[];
int    g_symbolCount = 0;

#define GENERIC_WRITE          0x40000000
#define OPEN_EXISTING          3
#define FILE_ATTRIB_NORM       0x80
#define FILE_FLAG_OVERLAPPED   0x40000000
#define WAIT_OBJECT_0          0
#define WAIT_TIMEOUT_CODE      0x102
#define PIPE_WRITE_TIMEOUT_MS  8

// ────────────────────────────────────────────────────────────────────────────
// Symbol list parsing
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Config loading (bridge/config.json overrides inputs; AccountCompany fallback)
// ────────────────────────────────────────────────────────────────────────────

string ExtractField(string json, string key) {
   int p = StringFind(json, "\"" + key + "\"");
   if (p < 0) return "";
   int colon = StringFind(json, ":", p);
   if (colon < 0) return "";
   p = colon + 1;

   while (p < StringLen(json)) {
      ushort c = StringGetCharacter(json, p);
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') p++;
      else break;
   }
   if (p >= StringLen(json)) return "";

   if (StringGetCharacter(json, p) == '"') {
      int start = p + 1;
      int end = StringFind(json, "\"", start);
      if (end < 0) return "";
      return StringSubstr(json, start, end - start);
   }

   int s = p;
   int e = StringFind(json, ",", s);
   if (e < 0) e = StringFind(json, "}", s);
   if (e < 0) e = StringLen(json);
   string v = StringSubstr(json, s, e - s);
   StringTrimLeft(v);
   StringTrimRight(v);
   return v;
}

void LoadConfig() {
   g_brokerName = BROKER_NAME;
   g_symbolsRaw = SYMBOLS;

   if (FileIsExist("bridge\\config.json")) {
      int handle = FileOpen("bridge\\config.json", FILE_READ | FILE_TXT | FILE_ANSI);
      if (handle != INVALID_HANDLE) {
         string content = "";
         while (!FileIsEnding(handle)) content += FileReadString(handle);
         FileClose(handle);

         string b = ExtractField(content, "brokerName");
         string s = ExtractField(content, "symbols");
         if (StringLen(b) > 0) g_brokerName = b;
         if (StringLen(s) > 0) g_symbolsRaw = s;
         Print("[STATE] Config loaded from config.json | broker: ", g_brokerName,
               " | symbols from config: ", (StringLen(s) > 0));
         return;
      }
   }

   string company = AccountCompany();
   if (StringLen(company) > 0) g_brokerName = company;
   Print("[STATE] No config.json — broker fallback: ", g_brokerName, " | symbols from input");
}

void ParseSymbols() {
   string raw = g_symbolsRaw;
   g_symbolCount = 0;
   ArrayResize(g_symbols, 0);

   int start = 0;
   for (int i = 0; i <= StringLen(raw); i++) {
      if (i == StringLen(raw) || StringGetCharacter(raw, i) == ',') {
         string sym = StringSubstr(raw, start, i - start);
         StringTrimLeft(sym);
         StringTrimRight(sym);
         if (StringLen(sym) > 0) {
            ArrayResize(g_symbols, g_symbolCount + 1);
            g_symbols[g_symbolCount] = sym;
            g_symbolCount++;
         }
         start = i + 1;
      }
   }
}

// ────────────────────────────────────────────────────────────────────────────
// Pipe management
// ────────────────────────────────────────────────────────────────────────────

void PipeClose() {
   if (g_pipe != INVALID_HANDLE) {
      CancelIo(g_pipe);
      CloseHandle(g_pipe);
      g_pipe = INVALID_HANDLE;
      Print("[PIPE] Disconnected | broker: ", g_brokerName);
   }
}

bool PipeConnect() {
   PipeClose();
   int flags = FILE_ATTRIB_NORM | FILE_FLAG_OVERLAPPED;
   g_pipe = CreateFileW(g_pipeName, GENERIC_WRITE, 0, 0, OPEN_EXISTING, flags, 0);
   if (g_pipe != INVALID_HANDLE) {
      g_timeouts    = 0;
      Print("[PIPE] Connected | broker: ", g_brokerName);
   } else {
      Print("[PIPE] Connection failed | broker: ", g_brokerName, " | backend running?");
   }
   return g_pipe != INVALID_HANDLE;
}

bool PipeWrite(string data) {
   ulong now = GetTickCount();

   if (g_pipe == INVALID_HANDLE) {
      if (!PipeConnect()) return false;
   }

   uchar buf[];
   int   written[];
   ArrayResize(written, 1);
   StringToCharArray(data, buf, 0, StringLen(data));

   ArrayInitialize(g_ovlp, 0);
   g_ovlp[4] = g_event;
   ResetEvent(g_event);

   WriteFile(g_pipe, buf, ArraySize(buf), written, g_ovlp);

   uint result = (uint)WaitForSingleObject(g_event, PIPE_WRITE_TIMEOUT_MS);

   if (result == WAIT_OBJECT_0) {
      g_timeouts = 0;
      return true;
   }

   CancelIo(g_pipe);
   g_timeouts++;

   if (result == WAIT_TIMEOUT_CODE)
      Print("[PIPE] Write timeout #", g_timeouts, " | broker: ", g_brokerName);
   else
      Print("[PIPE] Wait failed | result=", result, " | broker: ", g_brokerName);

   if (g_timeouts >= 3) {
      Print("[PIPE] Dead after ", g_timeouts, " timeouts — reconnecting | broker: ", g_brokerName);
      PipeClose();
      g_timeouts = 0;
   }

   return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Init / Deinit
// ────────────────────────────────────────────────────────────────────────────

int OnInit() {
   LoadConfig();
   ParseSymbols();
   g_pipeName = "\\\\.\\pipe\\mt4tick_" + g_brokerName;
   g_event = CreateEventW(0, 1, 0, 0);
   EventSetMillisecondTimer(100);

   Print("[STATE] HttpBridgeState v3.13 | broker: ", g_brokerName,
         " | symbols: ", g_symbolsRaw,
         " | symbol count: ", g_symbolCount,
         " | state every: ", STATE_EVERY_S, "s");

   Print("[STATE] Writing historical candles (", g_symbolCount, " symbols × 5 timeframes × 5000 bars)...");
   for (int i = 0; i < g_symbolCount; i++) {
      WriteHistoricalCandles(g_symbols[i], PERIOD_M5,  5000);
      WriteHistoricalCandles(g_symbols[i], PERIOD_M15, 5000);
      WriteHistoricalCandles(g_symbols[i], PERIOD_H1,  5000);
      WriteHistoricalCandles(g_symbols[i], PERIOD_H4,  5000);
      WriteHistoricalCandles(g_symbols[i], PERIOD_D1,  5000);
   }

   lastStateSend = GetTickCount64();
   Print("[STATE] Init complete | ready to stream ticks");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   PipeClose();
   if (g_event != INVALID_HANDLE) { CloseHandle(g_event); g_event = INVALID_HANDLE; }
   Print("[STATE] Stopped | reason: ", reason);
}

// ────────────────────────────────────────────────────────────────────────────
// Timer — 100ms tick batch + periodic state
// ────────────────────────────────────────────────────────────────────────────

void OnTimer() {
   ulong now = GetTickCount();

   // ── Tick batch: all symbols every 100ms ──────────────────────────────────
   int    brokerOffset = (int)(TimeCurrent() - TimeGMT());
   string batch        = "[";

   for (int i = 0; i < g_symbolCount; i++) {
      string sym = g_symbols[i];
      if (i > 0) batch += ",";
      batch += "{";
      batch += "\"symbol\":\""   + sym                                                      + "\",";
      batch += "\"bid\":"        + DoubleToString(MarketInfo(sym, MODE_BID), 5)             + ",";
      batch += "\"ask\":"        + DoubleToString(MarketInfo(sym, MODE_ASK), 5)             + ",";
      batch += "\"time\":"       + IntegerToString(TimeGMT() * 1000)                       + ",";
      batch += "\"broker_offset\":" + IntegerToString(brokerOffset)                        + ",";
      batch += "\"m5_time\":"    + IntegerToString(iTime(sym, PERIOD_M5,  0) * 1000)       + ",";
      batch += "\"m5_open\":"    + DoubleToString(iOpen(sym,  PERIOD_M5,  0), 5)           + ",";
      batch += "\"m5_high\":"    + DoubleToString(iHigh(sym,  PERIOD_M5,  0), 5)           + ",";
      batch += "\"m5_low\":"     + DoubleToString(iLow(sym,   PERIOD_M5,  0), 5)           + ",";
      batch += "\"m15_time\":"   + IntegerToString(iTime(sym, PERIOD_M15, 0) * 1000)       + ",";
      batch += "\"m15_open\":"   + DoubleToString(iOpen(sym,  PERIOD_M15, 0), 5)           + ",";
      batch += "\"m15_high\":"   + DoubleToString(iHigh(sym,  PERIOD_M15, 0), 5)           + ",";
      batch += "\"m15_low\":"    + DoubleToString(iLow(sym,   PERIOD_M15, 0), 5)           + ",";
      batch += "\"h1_time\":"    + IntegerToString(iTime(sym, PERIOD_H1,  0) * 1000)       + ",";
      batch += "\"h1_open\":"    + DoubleToString(iOpen(sym,  PERIOD_H1,  0), 5)           + ",";
      batch += "\"h1_high\":"    + DoubleToString(iHigh(sym,  PERIOD_H1,  0), 5)           + ",";
      batch += "\"h1_low\":"     + DoubleToString(iLow(sym,   PERIOD_H1,  0), 5)           + ",";
      batch += "\"h4_time\":"    + IntegerToString(iTime(sym, PERIOD_H4,  0) * 1000)       + ",";
      batch += "\"h4_open\":"    + DoubleToString(iOpen(sym,  PERIOD_H4,  0), 5)           + ",";
      batch += "\"h4_high\":"    + DoubleToString(iHigh(sym,  PERIOD_H4,  0), 5)           + ",";
      batch += "\"h4_low\":"     + DoubleToString(iLow(sym,   PERIOD_H4,  0), 5)           + ",";
      batch += "\"d1_time\":"    + IntegerToString(iTime(sym, PERIOD_D1,  0) * 1000)       + ",";
      batch += "\"d1_open\":"    + DoubleToString(iOpen(sym,  PERIOD_D1,  0), 5)           + ",";
      batch += "\"d1_high\":"    + DoubleToString(iHigh(sym,  PERIOD_D1,  0), 5)           + ",";
      batch += "\"d1_low\":"     + DoubleToString(iLow(sym,   PERIOD_D1,  0), 5);
      batch += "}";
   }
   batch += "]\n";

   PipeWrite(batch);

   // ── Live positions over the pipe every POSITIONS_EVERY_S ─────────────────
   if (now - lastPositionsSend >= (ulong)(POSITIONS_EVERY_S * 1000)) {
      lastPositionsSend = now;
      PipeWrite("{\"type\":\"positions\",\"positions\":" + BuildPositionsJson(OrdersTotal()) + "}\n");
   }

   // ── Live account over the pipe every ACCOUNT_EVERY_S ─────────────────────
   if (now - lastAccountSend >= (ulong)(ACCOUNT_EVERY_S * 1000)) {
      lastAccountSend = now;
      PipeWrite("{\"type\":\"account\"," + BuildAccountJson() + "}\n");
   }

   // ── State update: positions, account, history, candles every STATE_EVERY_S ──
   if (now - lastStateSend >= (ulong)(STATE_EVERY_S * 1000)) {
      lastStateSend = now;

      int posCount = OrdersTotal();
      WritePositions(posCount);
      WriteAccount();

      if (posCount != g_lastPositionCount) {
         Print("[STATE] Positions changed | open: ", posCount, " | broker: ", g_brokerName);
         g_lastPositionCount = posCount;
      }

      WriteHistory();
      for (int i = 0; i < g_symbolCount; i++) {
         WriteHistoricalCandles(g_symbols[i], PERIOD_M5,  RECENT_BARS);
         WriteHistoricalCandles(g_symbols[i], PERIOD_M15, RECENT_BARS);
         WriteHistoricalCandles(g_symbols[i], PERIOD_H1,  RECENT_BARS);
         WriteHistoricalCandles(g_symbols[i], PERIOD_H4,  RECENT_BARS);
         WriteHistoricalCandles(g_symbols[i], PERIOD_D1,  RECENT_BARS);
      }
   }
}

// ────────────────────────────────────────────────────────────────────────────
// State writers
// ────────────────────────────────────────────────────────────────────────────

string BuildAccountJson() {
   string j = "";
   j += "\"balance\":"    + DoubleToString(AccountBalance(), 2)    + ",";
   j += "\"equity\":"     + DoubleToString(AccountEquity(), 2)     + ",";
   j += "\"profit\":"     + DoubleToString(AccountProfit(), 2)     + ",";
   j += "\"margin\":"     + DoubleToString(AccountMargin(), 2)     + ",";
   j += "\"freeMargin\":" + DoubleToString(AccountFreeMargin(), 2) + ",";
   j += "\"leverage\":"   + IntegerToString(AccountLeverage())     + ",";
   j += "\"currency\":\"" + AccountCurrency()                      + "\",";
   j += "\"name\":\""     + AccountName()                         + "\",";
   j += "\"number\":"     + IntegerToString(AccountNumber());
   return j;
}

void WriteAccount() {
   WriteFile("account.json", "{" + BuildAccountJson() + "}");
}

void WritePositions(int total) {
   WriteFile("positions.json", BuildPositionsJson(total));
}

string BuildPositionsJson(int total) {
   string j = "[";
   int count = 0;
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (count > 0) j += ",";
      j += "{";
      j += "\"ticket\":"     + IntegerToString(OrderTicket())       + ",";
      j += "\"symbol\":\""   + OrderSymbol()                       + "\",";
      j += "\"type\":"       + IntegerToString(OrderType())         + ",";
      j += "\"lots\":"       + DoubleToString(OrderLots(), 2)       + ",";
      j += "\"openPrice\":"  + DoubleToString(OrderOpenPrice(), 5)  + ",";
      j += "\"sl\":"         + DoubleToString(OrderStopLoss(), 5)   + ",";
      j += "\"tp\":"         + DoubleToString(OrderTakeProfit(), 5) + ",";
      j += "\"profit\":"     + DoubleToString(OrderProfit(), 2)     + ",";
      j += "\"swap\":"       + DoubleToString(OrderSwap(), 2)       + ",";
      j += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
      j += "\"magic\":"      + IntegerToString(OrderMagicNumber())  + ",";
      j += "\"comment\":\""  + OrderComment()                      + "\",";
      j += "\"openTime\":\"" + TimeToString(OrderOpenTime())        + "\"";
      j += "}";
      count++;
   }
   j += "]";
   return j;
}

void WriteHistory() {
   string j = "[";
   int total = OrdersHistoryTotal(), count = 0;
   for (int i = total - 1; i >= 0 && count < 50; i--) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if (OrderType() != OP_BUY && OrderType() != OP_SELL) continue;
      if (count > 0) j += ",";
      j += "{";
      j += "\"ticket\":"      + IntegerToString(OrderTicket())        + ",";
      j += "\"symbol\":\""    + OrderSymbol()                        + "\",";
      j += "\"type\":"        + IntegerToString(OrderType())          + ",";
      j += "\"lots\":"        + DoubleToString(OrderLots(), 2)        + ",";
      j += "\"openPrice\":"   + DoubleToString(OrderOpenPrice(), 5)   + ",";
      j += "\"closePrice\":"  + DoubleToString(OrderClosePrice(), 5)  + ",";
      j += "\"sl\":"          + DoubleToString(OrderStopLoss(), 5)    + ",";
      j += "\"tp\":"          + DoubleToString(OrderTakeProfit(), 5)  + ",";
      j += "\"profit\":"      + DoubleToString(OrderProfit(), 2)      + ",";
      j += "\"swap\":"        + DoubleToString(OrderSwap(), 2)        + ",";
      j += "\"commission\":"  + DoubleToString(OrderCommission(), 2)  + ",";
      j += "\"magic\":"       + IntegerToString(OrderMagicNumber())   + ",";
      j += "\"comment\":\""   + OrderComment()                       + "\",";
      j += "\"openTime\":\""  + TimeToString(OrderOpenTime())         + "\",";
      j += "\"closeTime\":\"" + TimeToString(OrderCloseTime())        + "\"";
      j += "}";
      count++;
   }
   j += "]";
   WriteFile("history.json", j);
}

string PeriodToLabel(int period) {
   if (period == PERIOD_M5)  return "M5";
   if (period == PERIOD_M15) return "M15";
   if (period == PERIOD_H1)  return "H1";
   if (period == PERIOD_H4)  return "H4";
   if (period == PERIOD_D1)  return "D1";
   return "M15";
}

void WriteHistoricalCandles(string sym, int period, int maxBars) {
   int    total        = iBars(sym, period);
   int    limit        = MathMin(total - 1, maxBars);
   int    brokerOffset = (int)(TimeCurrent() - TimeGMT());
   string label        = PeriodToLabel(period);

   string candles = "";
   bool first = true;
   for (int i = limit; i >= 0; i--) {
      if (!first) candles += ",";
      candles += "{";
      candles += "\"time\":"  + IntegerToString(iTime(sym, period, i)) + ",";
      candles += "\"open\":"  + DoubleToString(iOpen(sym,  period, i), 5) + ",";
      candles += "\"high\":"  + DoubleToString(iHigh(sym,  period, i), 5) + ",";
      candles += "\"low\":"   + DoubleToString(iLow(sym,   period, i), 5) + ",";
      candles += "\"close\":" + DoubleToString(iClose(sym, period, i), 5);
      candles += "}";
      first = false;
   }

   string json = "{\"brokerOffset\":" + IntegerToString(brokerOffset) + ",\"candles\":[" + candles + "]}";
   WriteFile("candles_" + sym + "_" + label + ".json", json);
}

void WriteFile(string filename, string content) {
   int handle = FileOpen("bridge\\" + filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[STATE] ERROR: could not write file: ", filename);
      return;
   }
   FileWriteString(handle, content);
   FileClose(handle);
}
