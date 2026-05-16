import pino from 'pino';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const serviceName = process.env.OTEL_SERVICE_NAME || 'metl-service';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: serviceName,
    version: process.env.SERVICE_VERSION || '1.0.0',
  },
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  if (sdk) return;

  sdk = new NodeSDK({
    serviceName,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  logger.info('OpenTelemetry SDK initialized');
}

export function shutdownTelemetry(): Promise<void> {
  if (!sdk) return Promise.resolve();
  return sdk.shutdown().then(() => {
    logger.info('OpenTelemetry SDK shut down');
  });
}

export { logger as default };
