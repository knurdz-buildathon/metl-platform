import path from 'path';
import fs from 'fs/promises';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry, shutdownTelemetry } from '@metl/logger';
import { createDeployment, createService, createIngress, ensureNamespace } from '@metl/k8s';
import simpleGit from 'simple-git';
import { buildWithNixpacks } from './builders/nixpacks';

async function deployToVercel(sourceDir: string, token: string, teamId?: string): Promise<{ url: string; id: string }> {
  const tarballPath = `${sourceDir}.tar.gz`;
  const { execSync } = await import('child_process');
  execSync(`tar -czf ${tarballPath} -C ${sourceDir} .`);

  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fs.readFile ? await fs.readFile(tarballPath) : Buffer.alloc(0),
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    throw new Error(`Vercel deploy failed: ${deployRes.status} ${errText}`);
  }

  const deployJson = await deployRes.json() as any;
  return { url: deployJson.url, id: deployJson.id };
}

async function deployToNetlify(sourceDir: string, token: string, siteId?: string): Promise<{ url: string; id: string }> {
  const tarballPath = `${sourceDir}.zip`;
  const { execSync } = await import('child_process');
  execSync(`cd ${sourceDir} && zip -r ${tarballPath} .`);

  let targetSiteId = siteId;
  if (!targetSiteId) {
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `metl-${Date.now()}` }),
    });
    const siteJson = await siteRes.json() as any;
    targetSiteId = siteJson.id;
  }

  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    body: fs.readFile ? await fs.readFile(tarballPath) : Buffer.alloc(0),
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    throw new Error(`Netlify deploy failed: ${deployRes.status} ${errText}`);
  }

  const deployJson = await deployRes.json() as any;
  return { url: deployJson.deploy_url, id: deployJson.id };
}

initTelemetry();

const buildsDir = process.env.BUILDS_DIR || '/tmp/metl-builds';
const acrName = process.env.ACR_NAME || '';

async function handleBuild(task: any): Promise<void> {
  const { id, tenantId, payload } = task;
  const { gitUrl, branch, slug, deploymentId } = payload;

  await prisma.task.update({
    where: { id },
    data: { status: 'running' },
  });

  // Look up deployment to determine warm/cold tier
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
  const tier = deployment?.scalingTier === 'cold' ? 'cold' : 'warm';
  const memLimitMb = deployment?.memoryLimitMb || 512;

  // Notify visual twin of build start
  await bus.publish('events.visual.twin.deploy_build', {
    eventType: 'PROVISION_DB_STACK',
    tenantId,
    deploymentId,
    slug,
    tier,
    phase: 'clone',
    timestamp: new Date().toISOString(),
  });

  const buildDir = path.join(buildsDir, `${slug}-${Date.now()}`);
  const imageTag = `${acrName}.azurecr.io/metl/${slug}:${Date.now()}`;

  try {
    await fs.mkdir(buildDir, { recursive: true });

    // Clone repo
    logger.info({ gitUrl, branch, buildDir }, 'Cloning repository');
    const git = simpleGit();
    await git.clone(gitUrl, buildDir, ['--branch', branch, '--single-branch', '--depth', '1']);

    // Build: warm tier uses Nixpacks for sub-10s builds; cold tier uses Nixpacks + buildx push
    logger.info({ imageTag, tier }, `Building with ${tier === 'warm' ? 'Nixpacks' : 'Nixpacks + buildx push'}`);

    buildWithNixpacks(buildDir, slug, imageTag, tier);

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'running', imageTag },
    });

    // Look up provider matrix to determine hosting target
    const matrix = await prisma.providerMatrix.findUnique({ where: { tenantId } });
    const hostingMode = matrix?.hostingMode || 'metl';

    if (hostingMode === 'byok' && matrix?.hostingConfig) {
      const hostingConfig = matrix.hostingConfig as any;
      const provider = hostingConfig.provider || 'vercel';

      if (provider === 'vercel') {
        const result = await deployToVercel(buildDir, hostingConfig.vercelToken, hostingConfig.vercelTeamId);
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: { status: 'running', imageTag: result.url },
        });
        await prisma.task.update({
          where: { id },
          data: { status: 'completed', result: { url: result.url, vercelId: result.id } },
        });
        logger.info({ url: result.url, slug }, 'Deployed to Vercel');
      } else if (provider === 'netlify') {
        const result = await deployToNetlify(buildDir, hostingConfig.netlifyToken, hostingConfig.netlifySiteId);
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: { status: 'running', imageTag: result.url },
        });
        await prisma.task.update({
          where: { id },
          data: { status: 'completed', result: { url: result.url, netlifyId: result.id } },
        });
        logger.info({ url: result.url, slug }, 'Deployed to Netlify');
      } else {
        throw new Error(`Unsupported BYOK hosting provider: ${provider}`);
      }
    } else {
      // Metl native K3s deployment
      const namespace = `metl-${tenantId}`;
      await ensureNamespace(namespace, {
        cpu: '100m',
        memory: `${memLimitMb}Mi`,
        limitsCpu: tier === 'cold' ? '4000m' : '1000m',
        limitsMemory: tier === 'cold' ? `${Math.max(memLimitMb, 4096)}Mi` : `${memLimitMb}Mi`,
      });

      // Apply provider matrix env before deployment creation
      const env: Record<string, string> = { METL_SCALING_TIER: tier };
      if (matrix?.databaseMode === 'metl') {
        const db = await prisma.resource.findFirst({ where: { tenantId, type: 'postgres' } });
        if (db) env.DATABASE_URL = `postgresql://${(db.credentials as any).user}:${(db.credentials as any).password}@${db.endpoint}/app`;
      }

      await createDeployment(namespace, slug, imageTag, 3000, env, 1);
      await createService(namespace, slug, 3000);
      await createIngress(namespace, slug, `${slug}.metl.run`, slug, 3000);

      await prisma.task.update({
        where: { id },
        data: { status: 'completed', result: { imageTag } },
      });
    }

    await bus.publish('events.visual.twin.deploy_build', {
      eventType: 'PROVISION_DB_STACK',
      tenantId,
      deploymentId,
      slug,
      tier,
      phase: 'complete',
      timestamp: new Date().toISOString(),
    });

    logger.info({ imageTag, slug, tier }, 'Deployment complete');
  } catch (err) {
    await prisma.task.update({
      where: { id },
      data: { status: 'failed', error: String(err) },
    });
    await bus.publish('events.visual.twin.deploy_build', {
      eventType: 'PROVISION_DB_STACK',
      tenantId,
      deploymentId,
      slug,
      tier,
      phase: 'failed',
      error: String(err),
      timestamp: new Date().toISOString(),
    });
    logger.error({ err, slug, tier }, 'Build failed');
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
}

async function main() {
  await bus.connect();
  logger.info('Deployment Engine connected to NATS');

  await bus.subscribe('tasks.deploy.build', 'deployment-engine', handleBuild);

  logger.info('Deployment Engine listening');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Deployment Engine shutting down gracefully');
  bus.close().catch(() => null);
  shutdownTelemetry().then(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Deployment Engine');
  process.exit(1);
});
