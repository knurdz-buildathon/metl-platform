import * as k8s from '@kubernetes/client-node';
import { k8sApi, k8sAppsApi } from '../index';
import { logger } from '@metl/logger';

export function buildMinioDeployment(
  namespace: string,
  accessKey: string,
  secretKey: string,
): k8s.V1Deployment {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'minio-core', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'minio-core' } },
      template: {
        metadata: { labels: { app: 'minio-core' } },
        spec: {
          containers: [
            {
              name: 'minio',
              image: 'minio/minio:RELEASE.2024-05-10T01-41-38Z',
              command: ['minio', 'server', '/data', '--console-address', ':9001'],
              ports: [
                { containerPort: 9000, name: 's3' },
                { containerPort: 9001, name: 'console' },
              ],
              env: [
                { name: 'MINIO_ROOT_USER', value: accessKey },
                { name: 'MINIO_ROOT_PASSWORD', value: secretKey },
              ],
              volumeMounts: [{ name: 'minio-data', mountPath: '/data' }],
              resources: {
                requests: { cpu: '50m', memory: '256Mi' },
                limits: { cpu: '250m', memory: '512Mi' },
              },
              livenessProbe: {
                httpGet: { path: '/minio/health/live', port: 9000 },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/minio/health/ready', port: 9000 },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            },
          ],
          volumes: [
            {
              name: 'minio-data',
              persistentVolumeClaim: { claimName: 'minio-pvc' },
            },
          ],
        },
      },
    },
  };
}

export function buildMinioService(namespace: string): k8s.V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'minio-core', namespace },
    spec: {
      selector: { app: 'minio-core' },
      ports: [
        { port: 9000, targetPort: 9000, name: 's3' },
        { port: 9001, targetPort: 9001, name: 'console' },
      ],
      type: 'ClusterIP',
    },
  };
}

export function buildMinioPVC(namespace: string): k8s.V1PersistentVolumeClaim {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name: 'minio-pvc', namespace },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '20Gi' } },
    },
  };
}

export async function applyMinioStack(
  namespace: string,
  accessKey: string,
  secretKey: string,
): Promise<void> {
  const deploy = buildMinioDeployment(namespace, accessKey, secretKey);
  const svc = buildMinioService(namespace);
  const pvc = buildMinioPVC(namespace);

  try {
    await k8sApi.readNamespacedPersistentVolumeClaim('minio-pvc', namespace);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedPersistentVolumeClaim(namespace, pvc);
    } else {
      throw err;
    }
  }

  try {
    await k8sAppsApi.readNamespacedDeployment('minio-core', namespace);
    await k8sAppsApi.replaceNamespacedDeployment('minio-core', namespace, deploy);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedDeployment(namespace, deploy);
    } else {
      throw err;
    }
  }

  try {
    await k8sApi.readNamespacedService('minio-core', namespace);
    await k8sApi.replaceNamespacedService('minio-core', namespace, svc);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, svc);
    } else {
      throw err;
    }
  }

  logger.info({ namespace }, 'MinIO stack applied');
}
