import * as k8s from '@kubernetes/client-node';
import { k8sApi, k8sAppsApi } from '../index';
import { logger } from '@metl/logger';

export function buildPostgresStatefulSet(
  namespace: string,
  password: string,
): k8s.V1StatefulSet {
  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: { name: 'supabase-db', namespace },
    spec: {
      serviceName: 'supabase-db',
      replicas: 1,
      selector: { matchLabels: { app: 'supabase-db' } },
      template: {
        metadata: { labels: { app: 'supabase-db' } },
        spec: {
          containers: [
            {
              name: 'postgres',
              image: 'supabase/postgres:15.1.1.78',
              ports: [{ containerPort: 5432, name: 'postgres' }],
              env: [
                { name: 'POSTGRES_USER', value: 'postgres' },
                { name: 'POSTGRES_PASSWORD', value: password },
                { name: 'POSTGRES_DB', value: 'postgres' },
              ],
              volumeMounts: [
                { name: 'db-data', mountPath: '/var/lib/postgresql/data' },
              ],
              resources: {
                requests: { cpu: '100m', memory: '256Mi' },
                limits: { cpu: '500m', memory: '1Gi' },
              },
              livenessProbe: {
                exec: {
                  command: ['pg_isready', '-U', 'postgres'],
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                exec: {
                  command: ['pg_isready', '-U', 'postgres'],
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
      volumeClaimTemplates: [
        {
          metadata: { name: 'db-data' },
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '10Gi' } },
          },
        },
      ],
    },
  };
}

export function buildPostgresService(namespace: string): k8s.V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'supabase-db', namespace },
    spec: {
      selector: { app: 'supabase-db' },
      ports: [{ port: 5432, targetPort: 5432, name: 'postgres' }],
      type: 'ClusterIP',
    },
  };
}

export async function applyPostgresStack(namespace: string, password: string): Promise<void> {
  const ss = buildPostgresStatefulSet(namespace, password);
  const svc = buildPostgresService(namespace);

  try {
    await k8sAppsApi.readNamespacedStatefulSet('supabase-db', namespace);
    await k8sAppsApi.replaceNamespacedStatefulSet('supabase-db', namespace, ss);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedStatefulSet(namespace, ss);
    } else {
      throw err;
    }
  }

  try {
    await k8sApi.readNamespacedService('supabase-db', namespace);
    await k8sApi.replaceNamespacedService('supabase-db', namespace, svc);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, svc);
    } else {
      throw err;
    }
  }

  logger.info({ namespace }, 'Postgres StatefulSet applied');
}
