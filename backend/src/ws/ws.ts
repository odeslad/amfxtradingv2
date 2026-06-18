import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';

function authenticate(req: IncomingMessage): boolean {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) return false;
  try {
    jwt.verify(match[1], config.jwtSecret);
    return true;
  } catch {
    return false;
  }
}

export function createWss(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    if (!authenticate(req)) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    console.log(`[WS] Client connected (total: ${wss.clients.size})`);
    ws.on('close', () => console.log(`[WS] Client disconnected (total: ${wss.clients.size})`));
  });

  function broadcast(type: string, payload: unknown) {
    if (wss.clients.size === 0) return;
    const message = JSON.stringify({ type, ...( typeof payload === 'object' && payload !== null ? payload : { data: payload }) });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  return {
    broadcastTicks(broker: string, batch: unknown) {
      broadcast('ticks', { broker, ticks: batch });
    },
    broadcastPositions(broker: string, positions: unknown, currency: string) {
      broadcast('positions', { broker, currency, positions });
    },
  };
}
