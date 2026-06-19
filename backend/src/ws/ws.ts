import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getBid, getAsk } from '../store/ticks';

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
  };
}
