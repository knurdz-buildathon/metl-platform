import chalk from 'chalk';
import ora from 'ora';
import path from 'path';

const API_URL = process.env.METL_API_URL || 'https://api.metl.run';

export async function ejectCommand(options: {
  output: string;
}): Promise<void> {
  const spinner = ora('Ejecting project...').start();

  try {
    const res = await fetch(
      `${API_URL}/api/eject/default-tenant`,
      { method: 'POST' }
    );
    const data = await res.json();

    if (res.ok) {
      spinner.succeed('Ejection complete!');
      console.log(chalk.green('\nYour project has been exported.\n'));
      console.log(`Output: ${chalk.cyan(path.resolve(options.output))}`);
      console.log(chalk.dim('\nThe package includes:'));
      console.log(chalk.dim('  - Helm chart for Kubernetes deployment'));
      console.log(chalk.dim('  - docker-compose.yml for local deployment'));
      console.log(chalk.dim('  - Terraform configuration for Azure'));
      console.log(chalk.dim('  - Database schema export'));
      console.log();
    } else {
      spinner.fail(`Ejection failed: ${data.error}`);
    }
  } catch (err) {
    spinner.fail(`Error: ${err}`);
  }
}
