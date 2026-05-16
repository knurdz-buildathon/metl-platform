#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { deployCommand } from './commands/deploy';
import { logsCommand } from './commands/logs';
import { statusCommand } from './commands/status';
import { ejectCommand } from './commands/eject';

const program = new Command();

program
  .name('metl')
  .description('Metl CLI - Open Agentic Cloud Fabric')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy an application to Metl')
  .argument('<git-url>', 'Git repository URL')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .option('-n, --name <name>', 'Application name')
  .action(deployCommand);

program
  .command('logs')
  .description('Stream logs from a deployment')
  .argument('<deployment-id>', 'Deployment ID')
  .option('-f, --follow', 'Follow log output', false)
  .action(logsCommand);

program
  .command('status')
  .description('Check status of deployments')
  .option('-a, --all', 'Show all deployments', false)
  .action(statusCommand);

program
  .command('eject')
  .description('Eject your project with zero lock-in')
  .option('-o, --output <path>', 'Output directory', './metl-export')
  .action(ejectCommand);

program.parse();
