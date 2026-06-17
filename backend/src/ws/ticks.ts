import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { TickBatch } from '../bridge/pipe-reader';

export function createTicksWss(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/ticks' });

  wss.on('connection', (ws) => {
    console.log(`[WS] Client connected (total: ${wss.clients.size})`);
    ws.on('close', () => console.log(`[WS] Client disconnected (total: ${wss.clients.size})`));
  });

  return {
    broadcast(batch: TickBatch) {
      if (wss.clients.size === 0) return;
      const payload = JSON.stringify(batch);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
  };
}
