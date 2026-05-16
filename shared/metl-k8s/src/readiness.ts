import { k8sApi, k8sAppsApi } from './index';
import { logger } from '@metl/logger';

export async function waitForStatefulSet(
  namespace: string,
  name: string,
  timeoutMs = 120_000,
  intervalMs = 3_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { body } = await k8sAppsApi.readNamespacedStatefulSet(name, namespace);
      const ready = (body.status?.readyReplicas || 0) >= 1;
      if (ready) {
        logger.info({ namespace, name }, 'StatefulSet ready');
        return;
      }
    } catch {
      // StatefulSet may not exist yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for StatefulSet ${name} in namespace ${namespace}`);
}

export async function waitForDeployment(
  namespace: string,
  name: string,
  timeoutMs = 120_000,
  intervalMs = 3_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { body } = await k8sAppsApi.readNamespacedDeployment(name, namespace);
      const ready = (body.status?.readyReplicas || 0) >= (body.spec?.replicas || 1);
      if (ready) {
        logger.info({ namespace, name }, 'Deployment ready');
        return;
      }
    } catch {
      // Deployment may not exist yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for Deployment ${name} in namespace ${namespace}`);
}
