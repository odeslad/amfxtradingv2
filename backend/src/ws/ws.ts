import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getBid, getAsk } from '../store/ticks';
import { isAllowedOrigin, tokenFromCookie, sendDecision, HEARTBEAT_MS } from './policy';

interface Client extends WebSocket {
  userId: number;
  isAlive: boolean;
}

function verifyToken(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub?: unknown };
    return typeof payload.sub === 'number' ? payload.sub : null;
  } catch {
    return null;
  }
}

// End, don't destroy: a destroy right after the write can drop the buffered
// answer and nginx then reports the upstream as prematurely closed (502).
function reject(socket: Duplex, status: number, text: string): void {
  socket.once('finish', () => socket.destroy());
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export function createWss(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = wss.clients as Set<Client>;

  // Origin and session are checked before the socket exists: a rejected
  // handshake is a plain HTTP answer, never a WebSocket.
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/ws') { socket.destroy(); return; }
    if (!isAllowedOrigin(req.headers.origin)) { reject(socket, 403, 'Forbidden'); return; }
    const userId = verifyToken(tokenFromCookie(req.headers.cookie));
    if (userId === null) { reject(socket, 401, 'Unauthorized'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, userId));
  });

  wss.on('connection', (ws: Client, _req: IncomingMessage, userId: number) => {
    ws.userId = userId;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    console.log(`[WS] Client connected (user ${userId}, total: ${clients.size})`);
    ws.on('close', () => console.log(`[WS] Client disconnected (total: ${clients.size})`));
  });

  // A peer that missed one whole interval is gone: terminate, a close
  // handshake would never complete.
  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);

  function send(ws: Client, message: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    switch (sendDecision(ws.bufferedAmount)) {
      case 'terminate': ws.terminate(); return;
      case 'skip': return;
      case 'send': ws.send(message);
    }
  }

  const encode = (type: string, payload: unknown): string =>
    JSON.stringify({ type, ...(typeof payload === 'object' && payload !== null ? payload : { data: payload }) });

  function broadcast(type: string, payload: unknown): void {
    if (clients.size === 0) return;
    const message = encode(type, payload);
    for (const ws of clients) send(ws, message);
  }

  function sendToUser(userId: number, type: string, payload: unknown): void {
    if (clients.size === 0) return;
    const message = encode(type, payload);
    for (const ws of clients) if (ws.userId === userId) send(ws, message);
  }

  return {
    broadcastTicks(broker: string, batch: unknown) {
      broadcast('ticks', { broker, ticks: batch });
    },
    broadcastPositions(broker: string, positions: unknown, currency: string, brokerOffset: number) {
      const enriched = (positions as { symbol: string }[]).map(p => ({
        ...p,
        currentBid: getBid(broker, p.symbol) ?? null,
        currentAsk: getAsk(broker, p.symbol) ?? null,
      }));
      broadcast('positions', { broker, currency, brokerOffset, positions: enriched });
    },
    broadcastAccount(broker: string, account: unknown) {
      broadcast('account', { broker, account });
    },
    broadcastCommandResult(id: string, status: string, ticket?: number, error?: string) {
      broadcast('command_result', { id, status, ticket, error });
    },
    broadcastAlert(userId: number, broker: string, symbol: string, price: number, direction: string) {
      sendToUser(userId, 'alert', { userId, broker, symbol, price, direction });
    },
    broadcastEmaAlert(userId: number, broker: string, symbol: string, timeframe: string, direction: string) {
      sendToUser(userId, 'ema_alert', { userId, broker, symbol, timeframe, direction });
    },
    clientCount: () => clients.size,
    close() {
      clearInterval(heartbeat);
      for (const ws of clients) ws.terminate();
      wss.close();
    },
  };
}
