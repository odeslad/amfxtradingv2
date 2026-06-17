#property copyright "HttpBridge"
#property version   "2.11"
#property strict

input string BROKER_NAME = "ftmo";

int OnInit() {
   EventSetTimer(1);
   Print("[CMD] HttpBridgeCommands v2.11 | broker: ", BROKER_NAME, " | ready");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   FileDelete("bridge\\pending.json");
   Print("[CMD] Stopped | reason: ", reason);
}

void OnTimer() {
   CheckCommands();
}

void CheckCommands() {
   if (!FileIsExist("bridge\\command.json")) return;
   int handle = FileOpen("bridge\\command.json", FILE_READ | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[CMD] ERROR: could not open command.json");
      return;
   }
   string content = "";
   while (!FileIsEnding(handle)) content += FileReadString(handle);
   FileClose(handle);
   FileDelete("bridge\\command.json");
   if (StringLen(content) > 0) ExecuteCommand(content);
}

void ExecuteCommand(string json) {
   string action = ExtractField(json, "action");
   string symbol = ExtractField(json, "symbol");
   double lots   = StringToDouble(ExtractField(json, "lots"));
   double sl     = StringToDouble(ExtractField(json, "sl"));
   double tp     = StringToDouble(ExtractField(json, "tp"));
   double price  = StringToDouble(ExtractField(json, "price"));
   string cmdId  = ExtractField(json, "id");
   int    magic  = (int)StringToInteger(ExtractField(json, "magic"));

   Print("[CMD] Received: action=", action,
         " symbol=", symbol,
         " lots=", DoubleToString(lots, 2),
         " sl=", DoubleToString(sl, 5),
         " tp=", DoubleToString(tp, 5),
         " id=", cmdId);

   WritePending(cmdId, action, symbol);

   string result = "";

   if (action == "buy" || action == "sell") {
      int    cmd      = (action == "buy") ? OP_BUY : OP_SELL;
      double mktPrice = (cmd == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
      int    ticket   = OrderSend(symbol, cmd, lots, mktPrice, 3, sl, tp, "HttpBridge", magic, 0, clrNONE);
      if (ticket < 0) {
         int err = GetLastError();
         Print("[CMD] ERROR: ", action, " failed | code=", err, " symbol=", symbol, " lots=", DoubleToString(lots, 2), " id=", cmdId);
         result = ResultError(err, cmdId);
      } else {
         Print("[CMD] OK: ", action, " executed | ticket=", ticket, " symbol=", symbol, " lots=", DoubleToString(lots, 2), " price=", DoubleToString(mktPrice, 5));
         result = ResultOk(ticket, cmdId);
      }
   }
   else if (action == "buylimit" || action == "selllimit" || action == "buystop" || action == "sellstop") {
      int cmd = OP_BUYLIMIT;
      if (action == "buylimit")  cmd = OP_BUYLIMIT;
      if (action == "selllimit") cmd = OP_SELLLIMIT;
      if (action == "buystop")   cmd = OP_BUYSTOP;
      if (action == "sellstop")  cmd = OP_SELLSTOP;
      int ticket = OrderSend(symbol, cmd, lots, price, 3, sl, tp, "HttpBridge", magic, 0, clrNONE);
      if (ticket < 0) {
         int err = GetLastError();
         Print("[CMD] ERROR: ", action, " failed | code=", err, " symbol=", symbol, " price=", DoubleToString(price, 5), " id=", cmdId);
         result = ResultError(err, cmdId);
      } else {
         Print("[CMD] OK: ", action, " placed | ticket=", ticket, " symbol=", symbol, " price=", DoubleToString(price, 5));
         result = ResultOk(ticket, cmdId);
      }
   }
   else if (action == "close") {
      int ticket = (int)StringToInteger(ExtractField(json, "ticket"));
      if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
         Print("[CMD] ERROR: close failed | ticket not found: ", ticket, " id=", cmdId);
         result = "{\"status\":\"error\",\"message\":\"ticket not found\",\"id\":\"" + cmdId + "\"}";
      } else if (OrderType() == OP_BUY || OrderType() == OP_SELL) {
         double closePrice = (OrderType() == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
         bool closed = false;
         for (int i = 0; i < 5 && !closed; i++) {
            closed = OrderClose(ticket, OrderLots(), closePrice, 3, clrNONE);
            if (!closed) {
               Print("[CMD] Close attempt ", i + 1, "/5 failed | ticket=", ticket, " error=", GetLastError());
               Sleep(500);
            }
         }
         if (closed) {
            Print("[CMD] OK: close executed | ticket=", ticket, " symbol=", OrderSymbol(), " price=", DoubleToString(closePrice, 5));
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: close failed after 5 attempts | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      } else {
         bool deleted = OrderDelete(ticket);
         if (deleted) {
            Print("[CMD] OK: pending order deleted | ticket=", ticket);
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: delete pending failed | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      }
   }
   else if (action == "modify") {
      int ticket = (int)StringToInteger(ExtractField(json, "ticket"));
      if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
         Print("[CMD] ERROR: modify failed | ticket not found: ", ticket, " id=", cmdId);
         result = "{\"status\":\"error\",\"message\":\"ticket not found\",\"id\":\"" + cmdId + "\"}";
      } else {
         bool ok = OrderModify(ticket, OrderOpenPrice(), sl, tp, 0, clrNONE);
         if (ok) {
            Print("[CMD] OK: modify executed | ticket=", ticket, " sl=", DoubleToString(sl, 5), " tp=", DoubleToString(tp, 5));
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: modify failed | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      }
   }
   else {
      Print("[CMD] ERROR: unknown action '", action, "' | id=", cmdId);
   }

   if (result != "") {
      WriteFile("result.json", result);
      FileDelete("bridge\\pending.json");
   }
}

void WritePending(string id, string action, string symbol) {
   if (FileIsExist("bridge\\pending.json"))
      Print("[CMD] WARN: pending.json already exists — EA may have crashed or restarted mid-execution | new action=", action, " id=", id);
   string j = "{\"status\":\"processing\""
            + ",\"id\":\"" + id + "\""
            + ",\"action\":\"" + action + "\""
            + ",\"symbol\":\"" + symbol + "\""
            + "}";
   WriteFile("pending.json", j);
}

string ResultOk(int ticket, string id) {
   string t = ticket > 0 ? ",\"ticket\":" + IntegerToString(ticket) : "";
   return "{\"status\":\"ok\"" + t + ",\"id\":\"" + id + "\"}";
}

string ResultError(int code, string id) {
   return "{\"status\":\"error\",\"code\":" + IntegerToString(code) + ",\"id\":\"" + id + "\"}";
}

void WriteFile(string filename, string content) {
   int handle = FileOpen("bridge\\" + filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[CMD] ERROR: could not write file: ", filename);
      return;
   }
   FileWriteString(handle, content);
   FileClose(handle);
}

string ExtractField(string json, string key) {
   string search = "\"" + key + "\":\"";
   int start = StringFind(json, search);
   if (start < 0) {
      search = "\"" + key + "\":";
      start  = StringFind(json, search);
      if (start < 0) return "";
      start += StringLen(search);
      int end = StringFind(json, ",", start);
      if (end < 0) end = StringFind(json, "}", start);
      return StringSubstr(json, start, end - start);
   }
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   return StringSubstr(json, start, end - start);
}
