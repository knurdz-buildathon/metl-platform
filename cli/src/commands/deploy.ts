import chalk from 'chalk';
import ora from 'ora';

const API_URL = process.env.METL_API_URL || 'https://api.metl.run';

export async function deployCommand(
  gitUrl: string,
  options: { branch: string; name?: string }
): Promise<void> {
  const spinner = ora('Deploying to Metl...').start();

  try {
    const res = await fetch(`${API_URL}/api/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'default-tenant',
        gitUrl,
        branch: options.branch,
        name: options.name || gitUrl.split('/').pop()?.replace('.git', '') || 'app',
      }),
    });

    const data = await res.json();

    if (res.ok) {
      spinner.succeed(
        `Deployment started! ID: ${chalk.cyan(data.deployment.id)}`
      );
      console.log(`\n  URL: ${chalk.underline(`https://${data.deployment.slug}.metl.run`)}`);
      console.log(`  Status: ${chalk.yellow(data.deployment.status)}\n`);
    } else {
      spinner.fail(`Deployment failed: ${data.error}`);
    }
  } catch (err) {
    spinner.fail(`Error: ${err}`);
  }
}
