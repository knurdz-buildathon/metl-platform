import * as k8s from '@kubernetes/client-node';
import { logger } from '@metl/logger';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
export const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
export const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
export const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

// Re-export template builders and readiness helpers
export { applyPostgresStack } from './templates/postgres';
export { applyMinioStack } from './templates/minio';
export { applyListmonkStack } from './templates/listmonk';
export { applyKeycloakStack } from './templates/keycloak';
export { applyOtelCollectorStack } from './templates/signoz';
export { waitForStatefulSet, waitForDeployment } from './readiness';

export async function ensureNamespace(name: string, resourceQuota?: { cpu?: string; memory?: string; limitsCpu?: string; limitsMemory?: string }): Promise<void> {
  try {
    await k8sApi.readNamespace(name);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespace({
        metadata: { name },
      });
      logger.info({ namespace: name }, 'Created namespace');
    } else {
      throw err;
    }
  }

  // Create ResourceQuota to enforce warm-pool cgroups v2 limits (PDF Section 1.1)
  if (resourceQuota) {
    const rqName = `${name}-quota`;
    const resourceQuotaSpec: k8s.V1ResourceQuota = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: { name: rqName, namespace: name },
      spec: {
        hard: {
          ...(resourceQuota.cpu ? { 'requests.cpu': resourceQuota.cpu } : {}),
          ...(resourceQuota.memory ? { 'requests.memory': resourceQuota.memory } : {}),
          ...(resourceQuota.limitsCpu ? { 'limits.cpu': resourceQuota.limitsCpu } : {}),
          ...(resourceQuota.limitsMemory ? { 'limits.memory': resourceQuota.limitsMemory } : {}),
          'pods': '20',
          'services': '10',
          'persistentvolumeclaims': '5',
          'configmaps': '20',
        },
      },
    };

    try {
      await k8sApi.readNamespacedResourceQuota(rqName, name);
      await k8sApi.replaceNamespacedResourceQuota(rqName, name, resourceQuotaSpec);
    } catch (err: any) {
      if (err.statusCode === 404) {
        await k8sApi.createNamespacedResourceQuota(name, resourceQuotaSpec);
      } else {
        throw err;
      }
    }
    logger.info({ namespace: name }, 'Applied ResourceQuota for warm-pool isolation');
  }

  // Create LimitRange for default container resource bounds
  const lrName = `${name}-limits`;
  const limitRangeSpec: k8s.V1LimitRange = {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: { name: lrName, namespace: name },
    spec: {
      limits: [
        {
          type: 'Container',
          default: { cpu: '500m', memory: '512Mi' },
          defaultRequest: { cpu: '50m', memory: '64Mi' },
          max: { cpu: '2', memory: '4Gi' },
          min: { cpu: '10m', memory: '16Mi' },
        },
      ],
    },
  };

  try {
    await k8sApi.readNamespacedLimitRange(lrName, name);
    await k8sApi.replaceNamespacedLimitRange(lrName, name, limitRangeSpec);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedLimitRange(name, limitRangeSpec);
    } else {
      throw err;
    }
  }
  logger.info({ namespace: name }, 'Applied LimitRange');

  // Create NetworkPolicy for tenant isolation (deny cross-tenant ingress by default)
  const npName = `${name}-isolation`;
  const networkPolicySpec: k8s.V1NetworkPolicy = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: npName, namespace: name },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [
        {
          from: [
            { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': name } } },
            { namespaceSelector: { matchLabels: { 'metl-system': 'true' } } },
          ],
        },
      ],
    },
  };

  try {
    await k8sNetworkingApi.readNamespacedNetworkPolicy(npName, name);
    await k8sNetworkingApi.replaceNamespacedNetworkPolicy(npName, name, networkPolicySpec);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sNetworkingApi.createNamespacedNetworkPolicy(name, networkPolicySpec);
    } else {
      throw err;
    }
  }
  logger.info({ namespace: name }, 'Applied NetworkPolicy for tenant isolation');
}

export async function createSecret(
  namespace: string,
  name: string,
  data: Record<string, string>,
): Promise<void> {
  const encoded: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    encoded[key] = Buffer.from(value).toString('base64');
  }

  const secret: k8s.V1Secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name },
    type: 'Opaque',
    data: encoded,
  };

  try {
    await k8sApi.readNamespacedSecret(name, namespace);
    await k8sApi.replaceNamespacedSecret(name, namespace, secret);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedSecret(namespace, secret);
    } else {
      throw err;
    }
  }
  logger.info({ namespace, name }, 'Created/updated secret');
}

export async function createConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>,
): Promise<void> {
  const cm: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name },
    data,
  };

  try {
    await k8sApi.readNamespacedConfigMap(name, namespace);
    await k8sApi.replaceNamespacedConfigMap(name, namespace, cm);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedConfigMap(namespace, cm);
    } else {
      throw err;
    }
  }
}

export async function createDeployment(
  namespace: string,
  name: string,
  image: string,
  port: number,
  env: Record<string, string>,
  replicas = 1,
): Promise<void> {
  const envVars = Object.entries(env).map(([k, v]) => ({ name: k, value: v }));

  const deployment: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      labels: { app: name, 'metl-system': 'true' },
    },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: {
          labels: { app: name, 'metl-system': 'true' },
        },
        spec: {
          containers: [
            {
              name,
              image,
              ports: [{ containerPort: port }],
              env: envVars,
              resources: {
                requests: { cpu: '100m', memory: '128Mi' },
                limits: { cpu: '500m', memory: '512Mi' },
              },
            },
          ],
        },
      },
    },
  };

  try {
    await k8sAppsApi.readNamespacedDeployment(name, namespace);
    await k8sAppsApi.replaceNamespacedDeployment(name, namespace, deployment);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sAppsApi.createNamespacedDeployment(namespace, deployment);
    } else {
      throw err;
    }
  }
  logger.info({ namespace, name, image }, 'Created/updated deployment');
}

export async function createService(
  namespace: string,
  name: string,
  port: number,
): Promise<void> {
  const service: k8s.V1Service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name, labels: { app: name } },
    spec: {
      selector: { app: name },
      ports: [{ port, targetPort: port }],
      type: 'ClusterIP',
    },
  };

  try {
    await k8sApi.readNamespacedService(name, namespace);
    await k8sApi.replaceNamespacedService(name, namespace, service);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sApi.createNamespacedService(namespace, service);
    } else {
      throw err;
    }
  }
}

export async function createIngress(
  namespace: string,
  name: string,
  host: string,
  serviceName: string,
  servicePort: number,
): Promise<void> {
  const ingress: k8s.V1Ingress = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name,
      annotations: {
        'traefik.ingress.kubernetes.io/router.entrypoints': 'websecure',
        'cert-manager.io/cluster-issuer': 'letsencrypt',
      },
    },
    spec: {
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: { name: serviceName, port: { number: servicePort } },
                },
              },
            ],
          },
        },
      ],
      tls: [
        {
          hosts: [host],
          secretName: `${name}-tls`,
        },
      ],
    },
  };

  try {
    await k8sNetworkingApi.readNamespacedIngress(name, namespace);
    await k8sNetworkingApi.replaceNamespacedIngress(name, namespace, ingress);
  } catch (err: any) {
    if (err.statusCode === 404) {
      await k8sNetworkingApi.createNamespacedIngress(namespace, ingress);
    } else {
      throw err;
    }
  }
  logger.info({ namespace, host }, 'Created/updated ingress');
}

export async function deleteDeployment(namespace: string, name: string): Promise<void> {
  try {
    await k8sAppsApi.deleteNamespacedDeployment(name, namespace);
  } catch {
    // Ignore if not found
  }
}

export async function getTopology(namespace: string) {
  const [pods, services, ingresses, deployments] = await Promise.all([
    k8sApi.listNamespacedPod(namespace),
    k8sApi.listNamespacedService(namespace),
    k8sNetworkingApi.listNamespacedIngress(namespace),
    k8sAppsApi.listNamespacedDeployment(namespace),
  ]);

  return {
    pods: pods.body.items || [],
    services: services.body.items || [],
    ingresses: ingresses.body.items || [],
    deployments: deployments.body.items || [],
  };
}
