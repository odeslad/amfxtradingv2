#property copyright "HttpBridge"
#property version   "2.21"
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
input int    RECENT_BARS   = 100;
input int    REFRESH_EVERY = 30;

// ── Pipe state ──────────────────────────────────────────────────────────────
int    g_pipe         = INVALID_HANDLE;
int    g_event        = INVALID_HANDLE;
int    g_ovlp[5];       // Windows OVERLAPPED struct: 20 bytes / 5 × int32
                        // [0] Internal  [1] InternalHigh  [2] Offset
                        // [3] OffsetHigh  [4] hEvent
int    g_timeouts     = 0;

// ── Tick state ───────────────────────────────────────────────────────────────
int    timerCount     = 0;
ulong  lastPipeMs     = 0;
ulong  lastReconnect  = 0;
string pendingTick    = "";

// ── Position tracking (for change detection) ─────────────────────────────────
int    g_lastPositionCount = -1;

#define PIPE_NAME              "\\\\.\\pipe\\mt4tick"
#define GENERIC_WRITE          0x40000000
#define OPEN_EXISTING          3
#define FILE_ATTRIB_NORM       0x80
#define FILE_FLAG_OVERLAPPED   0x40000000
#define WAIT_OBJECT_0          0
#define WAIT_TIMEOUT_CODE      0x102
#define PIPE_THROTTLE_MS       100
#define PIPE_WRITE_TIMEOUT_MS  8
#define RECONNECT_INTERVAL_MS  30000
#define MAX_TIMEOUTS           3

// ────────────────────────────────────────────────────────────────────────────
// Pipe management
// ────────────────────────────────────────────────────────────────────────────

void PipeClose() {
   if (g_pipe != INVALID_HANDLE) {
      CancelIo(g_pipe);
      CloseHandle(g_pipe);
      g_pipe = INVALID_HANDLE;
      Print("[PIPE] Disconnected | broker: ", BROKER_NAME);
   }
}

bool PipeConnect() {
   PipeClose();
   int flags = FILE_ATTRIB_NORM | FILE_FLAG_OVERLAPPED;
   g_pipe = CreateFileW(PIPE_NAME, GENERIC_WRITE, 0, 0, OPEN_EXISTING, flags, 0);
   if (g_pipe != INVALID_HANDLE) {
      g_timeouts    = 0;
      lastReconnect = GetTickCount();
      Print("[PIPE] Connected | broker: ", BROKER_NAME);
   } else {
      Print("[PIPE] Connection failed | broker: ", BROKER_NAME, " | backend running?");
   }
   return g_pipe != INVALID_HANDLE;
}

bool PipeWrite(string data) {
   ulong now = GetTickCount();

   if (g_pipe == INVALID_HANDLE) {
      if (!PipeConnect()) return false;
   }

   if (now - lastReconnect >= RECONNECT_INTERVAL_MS) {
      Print("[PIPE] Periodic reconnect | broker: ", BROKER_NAME);
      PipeConnect();
      if (g_pipe == INVALID_HANDLE) return false;
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
      Print("[PIPE] Write timeout #", g_timeouts, " | broker: ", BROKER_NAME);
   else
      Print("[PIPE] Wait failed | result=", result, " broker: ", BROKER_NAME);

   if (g_timeouts >= MAX_TIMEOUTS) {
      Print("[PIPE] Dead after ", g_timeouts, " timeouts — reconnecting | broker: ", BROKER_NAME);
      PipeClose();
      g_timeouts = 0;
   }

   return false;
}

int OnInit() {
   EventSetTimer(1);
   g_event = CreateEventW(0, 1, 0, 0);
   Print("[STATE] HttpBridgeState v2.21 | broker: ", BROKER_NAME,
         " | symbol: ", Symbol(),
         " | refresh every: ", REFRESH_EVERY, "s");
   Print("[STATE] Writing historical candles (5 timeframes × 5000 bars)...");
   WriteHistoricalCandles(PERIOD_M5,  5000);
   WriteHistoricalCandles(PERIOD_M15, 5000);
   WriteHistoricalCandles(PERIOD_H1,  5000);
   WriteHistoricalCandles(PERIOD_H4,  5000);
   WriteHistoricalCandles(PERIOD_D1,  5000);
   Print("[STATE] Init complete | ready to stream ticks");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   PipeClose();
   if (g_event != INVALID_HANDLE) { CloseHandle(g_event); g_event = INVALID_HANDLE; }
   Print("[STATE] Stopped | reason: ", reason);
}

void OnTick() {
   string sym = Symbol();

   int brokerOffset = (int)(TimeCurrent() - TimeGMT());
   pendingTick = "{\"broker\":\"" + BROKER_NAME + "\","
               + "\"symbol\":\"" + sym + "\","
               + "\"bid\":"            + DoubleToString(MarketInfo(sym, MODE_BID), 5) + ","
               + "\"ask\":"            + DoubleToString(MarketInfo(sym, MODE_ASK), 5) + ","
               + "\"time\":"           + IntegerToString(TimeGMT() * 1000) + ","
               + "\"broker_offset\":"  + IntegerToString(brokerOffset) + ","
               + "\"m5_time\":"        + IntegerToString(iTime(sym, PERIOD_M5,  0) * 1000) + ","
               + "\"m5_open\":"        + DoubleToString(iOpen(sym,  PERIOD_M5,  0), 5) + ","
               + "\"m5_high\":"        + DoubleToString(iHigh(sym,  PERIOD_M5,  0), 5) + ","
               + "\"m5_low\":"         + DoubleToString(iLow(sym,   PERIOD_M5,  0), 5) + ","
               + "\"m15_time\":"       + IntegerToString(iTime(sym, PERIOD_M15, 0) * 1000) + ","
               + "\"m15_open\":"       + DoubleToString(iOpen(sym,  PERIOD_M15, 0), 5) + ","
               + "\"m15_high\":"       + DoubleToString(iHigh(sym,  PERIOD_M15, 0), 5) + ","
               + "\"m15_low\":"        + DoubleToString(iLow(sym,   PERIOD_M15, 0), 5) + ","
               + "\"h1_time\":"        + IntegerToString(iTime(sym, PERIOD_H1,  0) * 1000) + ","
               + "\"h1_open\":"        + DoubleToString(iOpen(sym,  PERIOD_H1,  0), 5) + ","
               + "\"h1_high\":"        + DoubleToString(iHigh(sym,  PERIOD_H1,  0), 5) + ","
               + "\"h1_low\":"         + DoubleToString(iLow(sym,   PERIOD_H1,  0), 5) + ","
               + "\"h4_time\":"        + IntegerToString(iTime(sym, PERIOD_H4,  0) * 1000) + ","
               + "\"h4_open\":"        + DoubleToString(iOpen(sym,  PERIOD_H4,  0), 5) + ","
               + "\"h4_high\":"        + DoubleToString(iHigh(sym,  PERIOD_H4,  0), 5) + ","
               + "\"h4_low\":"         + DoubleToString(iLow(sym,   PERIOD_H4,  0), 5) + ","
               + "\"d1_time\":"        + IntegerToString(iTime(sym, PERIOD_D1,  0) * 1000) + ","
               + "\"d1_open\":"        + DoubleToString(iOpen(sym,  PERIOD_D1,  0), 5) + ","
               + "\"d1_high\":"        + DoubleToString(iHigh(sym,  PERIOD_D1,  0), 5) + ","
               + "\"d1_low\":"         + DoubleToString(iLow(sym,   PERIOD_D1,  0), 5)
               + "}\n";

   ulong now = GetTickCount();
   if (now - lastPipeMs >= PIPE_THROTTLE_MS) {
      if (PipeWrite(pendingTick)) {
         lastPipeMs  = now;
         pendingTick = "";
      }
   }
}

void OnTimer() {
   int posCount = OrdersTotal();

   WritePositions(posCount);
   WriteAccount();

   // Log only when position count changes
   if (posCount != g_lastPositionCount) {
      Print("[STATE] Positions update | open: ", posCount, " | broker: ", BROKER_NAME);
      g_lastPositionCount = posCount;
   }

   if (timerCount % 60 == 0) {
      WriteHistory();
      Print("[STATE] History refreshed | broker: ", BROKER_NAME);
   }

   timerCount++;

   if (timerCount % REFRESH_EVERY == 0) {
      Print("[STATE] Refreshing candles (", RECENT_BARS, " bars × 5 tf) | broker: ", BROKER_NAME);
      WriteHistoricalCandles(PERIOD_M5,  RECENT_BARS);
      WriteHistoricalCandles(PERIOD_M15, RECENT_BARS);
      WriteHistoricalCandles(PERIOD_H1,  RECENT_BARS);
      WriteHistoricalCandles(PERIOD_H4,  RECENT_BARS);
      WriteHistoricalCandles(PERIOD_D1,  RECENT_BARS);
   }
}

void WriteAccount() {
   string j = "{";
   j += "\"balance\":"    + DoubleToString(AccountBalance(), 2)    + ",";
   j += "\"equity\":"     + DoubleToString(AccountEquity(), 2)     + ",";
   j += "\"profit\":"     + DoubleToString(AccountProfit(), 2)     + ",";
   j += "\"margin\":"     + DoubleToString(AccountMargin(), 2)     + ",";
   j += "\"freeMargin\":" + DoubleToString(AccountFreeMargin(), 2) + ",";
   j += "\"leverage\":"   + IntegerToString(AccountLeverage())     + ",";
   j += "\"currency\":\"" + AccountCurrency()                      + "\",";
   j += "\"name\":\""     + AccountName()                         + "\",";
   j += "\"number\":"     + IntegerToString(AccountNumber());
   j += "}";
   WriteFile("account.json", j);
}

void WritePositions(int total) {
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
   WriteFile("positions.json", j);
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

void WriteHistoricalCandles(int period = PERIOD_M15, int maxBars = 5000) {
   string sym          = Symbol();
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
   Print("[STATE] Candles written | ", sym, " ", label, " bars: ", limit, " offset: ", brokerOffset, "s");
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
