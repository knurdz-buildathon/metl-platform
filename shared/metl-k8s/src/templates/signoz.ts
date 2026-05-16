import * as k8s from '@kubernetes/client-node';
import { k8sApi, k8sAppsApi } from '../index';
import { logger } from '@metl/logger';

export function buildOtelCollectorDeployment(namespace: string): k8s.V1Deployment {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'otel-collector', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'otel-collector' } },
      template: {
        metadata: { labels: { app: 'otel-collector' } },
        spec: {
          containers: [
            {
              name: 'otel-collector',
              image: 'otel/opentelemetry-collector-contrib:0.100.0',
              command: ['--config=/conf/otel-collector-config.yaml'],
              ports: [
                { containerPort: 4317, name: 'otlp-grpc' },
                { containerPort: 4318, name: 'otlp-http' },
                { containerPort: 8889, name: 'metrics' },
              ],
              resources: {
                requests: { cpu: '50m', memory: '128Mi' },
                limits: { cpu: '200m', memory: '256Mi' },
              },
              livenessProbe: {
                httpGet: { path: '/', port: 13133 },
                initialDelaySeconds: 15,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/', port: 13133 },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
    },
  };
}

export function buildOtelCollectorService(namespace: string): k8s.V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'otel-collector', namespace },
    spec: {
      selector: { app: 'otel-collector' },
      ports: [
        { port: 4317, targetPort: 4317, name: 'otlp-grpc' },
        { port: 4318, targetPort: 4318, name: 'otlp-http' },
        { port: 8889, targetPort: 8889, name: 'metrics' },
      ],
      type: 'ClusterIP',
    },
  };
}

export async function applyOtelCollectorStack(namespace: string): Promise<void> {
  const deploy = buildOtelCollectorDeployment(namespace);
  const svc = buildOtelCollectorService(namespace);

  try {
    await k8sAppsApi.readNamespacedDeployment('otel-collector', namespace);
    await k8sAppsApi.replaceNamespacedDeployment('otel-collector', namespace, deploy);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedDeployment(namespace, deploy);
    } else {
      throw err;
    }
  }

  try {
    await k8sApi.readNamespacedService('otel-collector', namespace);
    await k8sApi.replaceNamespacedService('otel-collector', namespace, svc);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, svc);
    } else {
      throw err;
    }
  }

  logger.info({ namespace }, 'OTel Collector stack applied');
}
