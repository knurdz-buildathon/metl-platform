import * as k8s from '@kubernetes/client-node';
import { k8sApi, k8sAppsApi } from '../index';
import { logger } from '@metl/logger';

export function buildKeycloakDeployment(
  namespace: string,
  adminUser: string,
  adminPassword: string,
  dbUrl: string,
): k8s.V1Deployment {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'keycloak', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'keycloak' } },
      template: {
        metadata: { labels: { app: 'keycloak' } },
        spec: {
          containers: [
            {
              name: 'keycloak',
              image: 'quay.io/keycloak/keycloak:24.0.4',
              command: ['start-dev'],
              ports: [{ containerPort: 8080, name: 'http' }],
              env: [
                { name: 'KEYCLOAK_ADMIN', value: adminUser },
                { name: 'KEYCLOAK_ADMIN_PASSWORD', value: adminPassword },
                { name: 'KC_DB', value: 'postgres' },
                { name: 'KC_DB_URL', value: dbUrl },
                { name: 'KC_DB_USERNAME', value: 'postgres' },
                { name: 'KC_DB_PASSWORD', value: adminPassword },
                { name: 'KC_HOSTNAME_URL', value: `http://keycloak.${namespace}.svc.cluster.local:8080` },
              ],
              resources: {
                requests: { cpu: '200m', memory: '512Mi' },
                limits: { cpu: '1', memory: '2Gi' },
              },
              livenessProbe: {
                httpGet: { path: '/health/live', port: 8080 },
                initialDelaySeconds: 60,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/health/ready', port: 8080 },
                initialDelaySeconds: 30,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
    },
  };
}

export function buildKeycloakService(namespace: string): k8s.V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'keycloak', namespace },
    spec: {
      selector: { app: 'keycloak' },
      ports: [{ port: 8080, targetPort: 8080, name: 'http' }],
      type: 'ClusterIP',
    },
  };
}

export async function applyKeycloakStack(
  namespace: string,
  adminUser: string,
  adminPassword: string,
  dbUrl: string,
): Promise<void> {
  const deploy = buildKeycloakDeployment(namespace, adminUser, adminPassword, dbUrl);
  const svc = buildKeycloakService(namespace);

  try {
    await k8sAppsApi.readNamespacedDeployment('keycloak', namespace);
    await k8sAppsApi.replaceNamespacedDeployment('keycloak', namespace, deploy);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedDeployment(namespace, deploy);
    } else {
      throw err;
    }
  }

  try {
    await k8sApi.readNamespacedService('keycloak', namespace);
    await k8sApi.replaceNamespacedService('keycloak', namespace, svc);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, svc);
    } else {
      throw err;
    }
  }

  logger.info({ namespace }, 'Keycloak stack applied');
}
