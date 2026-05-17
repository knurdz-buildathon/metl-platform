import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { initTelemetry, logger, shutdownTelemetry } from '@metl/logger';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';

import { chatRouter } from './routes/chat';
import { deploymentsRouter } from './routes/deployments';
import { providerRouter } from './routes/provider';
import { topologyRouter } from './routes/topology';
import { ejectRouter } from './routes/eject';
import { incidentsRouter } from './routes/incidents';
import { alertsRouter } from './routes/alerts';
import { visualTwinRouter } from './routes/visual-twin';
import { attachWebSocket } from './routes/ws';
import { authRouter } from './routes/auth';
import { billingRouter } from './routes/billing';
import { dodoWebhookRouter } from './routes/webhooks/dodo';

dotenv.config();
initTelemetry();

const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Auth routes (public)
app.use('/api/auth', authRouter);

// Webhooks (public, signature-verified internally)
app.use('/api/webhooks/dodo', dodoWebhookRouter);

// Billing routes (auth required inside router)
app.use('/api/billing', billingRouter);

// Health check
app.get('/health', async (_req, res) => {
  const dbHealthy = await prisma.$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);
  res.json({ status: dbHealthy ? 'ok' : 'degraded', service: 'control-plane' });
});

// API routes — all existing routes remain functional
app.use('/api/chat', chatRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/provider', providerRouter);
app.use('/api/topology', topologyRouter);
app.use('/api/eject', ejectRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/visual-twin', visualTwinRouter);

// Global error handler: structured error response
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  const code = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  const details = err.details || (err.stack ? err.stack.split('\n').slice(0, 3) : undefined);
  res.status(code).json({
    error: {
      code: `ERR_${code}`,
      message,
      details: details || null,
    },
  });
});

let isShuttingDown = false;

async function main() {
  await bus.connect();
  logger.info('Control Plane connected to NATS');

  // Attach WebSocket to same HTTP server for visual twin
  attachWebSocket(server);
  logger.info('Visual Twin WebSocket attached');

  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Control Plane listening (HTTP + WS)');
  });
}

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Control Plane shutting down gracefully');

  server.close(() => {
    logger.info('HTTP/WS server closed');
    bus.close().catch(() => null);
    shutdownTelemetry().then(() => {
      prisma.$disconnect().then(() => process.exit(0));
    });
  });

  // Force exit after 15s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Control Plane');
  process.exit(1);
});
