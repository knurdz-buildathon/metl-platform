import chalk from 'chalk';
import ora from 'ora';

const API_URL = process.env.METL_API_URL || 'https://api.metl.run';

interface Deployment {
  id: string;
  name: string;
  slug: string;
  status: string;
  imageTag?: string;
  updatedAt: string;
}

export async function statusCommand(options: { all: boolean }): Promise<void> {
  const spinner = ora('Fetching status...').start();

  try {
    const res = await fetch(
      `${API_URL}/api/deployments?tenantId=default-tenant`
    );
    const data = await res.json();
    const deployments: Deployment[] = data.deployments || [];

    spinner.stop();

    if (deployments.length === 0) {
      console.log(chalk.yellow('\nNo deployments found.\n'));
      return;
    }

    console.log(chalk.bold('\nDeployments:\n'));
    console.log(
      chalk.gray(
        `${'ID'.padEnd(28)} ${'Name'.padEnd(20)} ${'Status'.padEnd(12)} ${'URL'}`
      )
    );
    console.log(chalk.gray('─'.repeat(80)));

    for (const d of deployments) {
      const statusColor =
        d.status === 'running'
          ? chalk.green
          : d.status === 'error'
          ? chalk.red
          : chalk.yellow;
      console.log(
        `${d.id.padEnd(28)} ${d.name.padEnd(20)} ${statusColor(
          d.status.padEnd(12)
        )} https://${d.slug}.metl.run`
      );
    }
    console.log();
  } catch (err) {
    spinner.fail(`Error: ${err}`);
  }
}
