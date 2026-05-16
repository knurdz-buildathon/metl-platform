import * as k8s from '@kubernetes/client-node';
import { k8sApi, k8sAppsApi } from '../index';
import { logger } from '@metl/logger';

export function buildListmonkDeployment(
  namespace: string,
  dbUrl: string,
): k8s.V1Deployment {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'listmonk', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'listmonk' } },
      template: {
        metadata: { labels: { app: 'listmonk' } },
        spec: {
          initContainers: [
            {
              name: 'listmonk-setup',
              image: 'listmonk/listmonk:v3.0.0',
              command: ['./listmonk', '--install', '--yes'],
              env: [{ name: 'LISTMONK_db__host', value: dbUrl }],
            },
          ],
          containers: [
            {
              name: 'listmonk',
              image: 'listmonk/listmonk:v3.0.0',
              ports: [{ containerPort: 9000, name: 'http' }],
              env: [{ name: 'LISTMONK_db__host', value: dbUrl }],
              resources: {
                requests: { cpu: '50m', memory: '128Mi' },
                limits: { cpu: '200m', memory: '256Mi' },
              },
              livenessProbe: {
                httpGet: { path: '/api/health', port: 9000 },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/api/health', port: 9000 },
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

export function buildListmonkService(namespace: string): k8s.V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'listmonk', namespace },
    spec: {
      selector: { app: 'listmonk' },
      ports: [{ port: 9000, targetPort: 9000, name: 'http' }],
      type: 'ClusterIP',
    },
  };
}

export async function applyListmonkStack(namespace: string, dbUrl: string): Promise<void> {
  const deploy = buildListmonkDeployment(namespace, dbUrl);
  const svc = buildListmonkService(namespace);

  try {
    await k8sAppsApi.readNamespacedDeployment('listmonk', namespace);
    await k8sAppsApi.replaceNamespacedDeployment('listmonk', namespace, deploy);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedDeployment(namespace, deploy);
    } else {
      throw err;
    }
  }

  try {
    await k8sApi.readNamespacedService('listmonk', namespace);
    await k8sApi.replaceNamespacedService('listmonk', namespace, svc);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, svc);
    } else {
      throw err;
    }
  }

  logger.info({ namespace }, 'Listmonk stack applied');
}
