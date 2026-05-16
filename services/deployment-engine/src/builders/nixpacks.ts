import { execSync } from 'child_process';
import { logger } from '@metl/logger';

export interface NixpacksPlan {
  providers?: string[];
  buildImage?: string;
  startCommand?: string;
  [key: string]: unknown;
}

/**
 * Detect the application's language/build plan using Nixpacks.
 */
export function detectPlan(repoPath: string): NixpacksPlan {
  try {
    const output = execSync(`nixpacks plan --format json ${repoPath}`, {
      encoding: 'utf8',
      timeout: 30_000,
      cwd: repoPath,
    });
    return JSON.parse(output) as NixpacksPlan;
  } catch (err) {
    logger.warn({ err, repoPath }, 'Nixpacks plan detection failed, falling back');
    return { providers: ['node'], buildImage: 'node:20-alpine', startCommand: 'npm start' };
  }
}

/**
 * Build an OCI image using Nixpacks and return the produced image tag.
 *
 * Warm tier:   nixpacks build directly into a local or ACR-tagged image.
 * Cold tier:   nixpacks build + docker buildx push for isolated nodes.
 */
export function buildWithNixpacks(
  repoPath: string,
  slug: string,
  imageTag: string,
  tier: 'warm' | 'cold' = 'warm',
): void {
  const plan = detectPlan(repoPath);
  logger.info({ providers: plan.providers, tier, slug }, 'Nixpacks plan detected');

  // Build the Nixpacks Dockerfile first so we can optionally layer it with buildx for cold tier
  const nixpacksDockerfilePath = path.join(repoPath, 'Nixpacks.dockerfile');

  if (tier === 'warm') {
    // Warm tier: direct nixpacks build targeting the image tag
    execSync(
      `nixpacks build ${repoPath} --name ${imageTag} --no-error-without-start`,
      { stdio: 'inherit', timeout: 300_000 }
    );
  } else {
    // Cold tier: generate Dockerfile via nixpacks, then buildx push for isolated node compatibility
    execSync(
      `nixpacks build ${repoPath} --name ${imageTag} --no-error-without-start`,
      { stdio: 'inherit', timeout: 300_000 }
    );

    // After nixpacks produces the image locally, push it via buildx to the registry
    execSync(
      `docker buildx build --platform linux/amd64 -t ${imageTag} --push ${repoPath}`,
      { stdio: 'inherit', timeout: 300_000 }
    );
  }

  logger.info({ imageTag, tier, slug }, 'Nixpacks build complete');
}
