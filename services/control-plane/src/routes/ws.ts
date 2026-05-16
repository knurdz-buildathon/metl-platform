import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { bus } from '@metl/bus';
import { logger } from '@metl/logger';

interface VisualTwinClient {
  ws: WebSocket;
  tenantId?: string;
  subscribed: boolean;
}

const clients = new Map<string, VisualTwinClient>();
let messageBusConnected = false;

/**
 * Attach a WebSocket server to the existing HTTP server for real-time
 * Visual Twin event streaming over /ws/visual-twin.
 */
export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({
    server,
    path: '/ws/visual-twin',
  });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client: VisualTwinClient = { ws, subscribed: false };
    clients.set(clientId, client);
    logger.info({ clientId, total: clients.size }, 'Visual Twin WebSocket client connected');

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && msg.tenantId) {
          client.tenantId = msg.tenantId;
          client.subscribed = true;
          ws.send(JSON.stringify({ type: 'subscribed', tenantId: msg.tenantId }));
        }
      } catch {
        // ignore invalid messages
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      logger.info({ clientId, total: clients.size }, 'Visual Twin WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      logger.error({ clientId, err }, 'WebSocket client error');
      clients.delete(clientId);
    });

    // Send initial connection acknowledgement
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'connected', clientId }));
    }
  });

  // Subscribe to NATS visual-twin events once and fan out to connected clients
  if (!messageBusConnected) {
    messageBusConnected = true;
    (async () => {
      try {
        await bus.subscribe('events.visual.twin.*', 'visual-twin-ws', async (data: any) => {
          const payload = JSON.stringify({ type: 'event', data });
          for (const [id, c] of clients) {
            if (c.subscribed && c.ws.readyState === WebSocket.OPEN) {
              const tenantMatch = !c.tenantId || !data.tenantId || c.tenantId === data.tenantId;
              if (tenantMatch || data.eventType === 'GLOBAL') {
                c.ws.send(payload, (err) => {
                  if (err) {
                    logger.warn({ clientId: id, err }, 'Failed to send WebSocket message');
                    c.ws.close();
                    clients.delete(id);
                  }
                });
              }
            }
          }
        });
        logger.info('Visual Twin subscribed to NATS events.visual.twin.*');
      } catch (err) {
        logger.error({ err }, 'Failed to subscribe visual twin to NATS');
      }
    })();
  }
}

export function getActiveClientCount(): number {
  return clients.size;
}
