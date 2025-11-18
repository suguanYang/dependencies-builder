import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { enable } from './utils/debug'
import { runWithContext } from './context'

yargs(hideBin(process.argv))
  .command(
    'analyze <repository>',
    'Analyze a project repository for dependencies',
    (yargs) => {
      return yargs
        .positional('repository', {
          describe: 'Git repository URL or local directory to analyze',
          type: 'string',
          demandOption: true,
        })
        .option('branch', {
          describe: 'Branch name to analyze',
          type: 'string',
          demandOption: true,
        })
        .option('verbose', {
          alias: 'v',
          describe: 'Enable verbose output',
          type: 'boolean',
          default: false,
        })
        .option('action-id', {
          describe: 'the server side action id',
          type: 'string',
        })
        .option('name', {
          describe: 'Project name for monorepo analysis',
          type: 'string',
          demandOption: true,
        })
        .option('type', {
          describe: 'Project type',
          type: 'string',
        })
        .option('ignore-call-graph', {
          describe: 'Skip call graph generation to speed up analysis',
          type: 'boolean',
          default: false,
        })
    },
    async (argv) => {
      const { analyzeProject } = await import('./commands/analyze')
      if (argv.verbose) {
        enable()
      }

      await runWithContext(
        {
          branch: argv.branch,
          repository: argv.repository,
          name: argv.name,
          type: argv.type as any,
          actionId: argv.actionId,
          ignoreCallGraph: argv.ignoreCallGraph,
        },
        analyzeProject,
      )
    },
  )
  .command(
    'report <repository>',
    'Generate a dependency report from the analysis result and the server database',
    (yargs) => {
      return yargs
        .positional('repository', {
          describe: 'Git repository URL or local directory to analyze',
          type: 'string',
          demandOption: true,
        })
        .option('branch', {
          describe: 'Branch name to analyze',
          type: 'string',
          default: 'main',
        })
        .option('target-branch', {
          describe: 'Target branch name to compare against',
          type: 'string',
          demandOption: true,
        })
        .option('name', {
          describe: 'Project name for monorepo analysis',
          type: 'string',
          demandOption: true,
        })
        .option('type', {
          describe: 'Project type',
          type: 'string',
        })
        .option('action-id', {
          describe: 'the server side action id',
          type: 'string',
        })
        .option('ignore-call-graph', {
          describe: 'Skip call graph generation to speed up analysis',
          type: 'boolean',
          default: false,
        })
        .option('verbose', {
          alias: 'v',
          describe: 'Enable verbose output',
          type: 'boolean',
          default: false,
        })
    },
    async (argv) => {
      const { generateReport } = await import('./commands/report')
      if (argv.verbose) {
        enable()
      }

      await runWithContext(
        {
          branch: argv.branch,
          repository: argv.repository,
          targetBranch: argv.targetBranch,
          name: argv.name,
          type: argv.type as any,
          actionId: argv.actionId,
          ignoreCallGraph: argv.ignoreCallGraph,
        },
        () => generateReport(),
      )
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .strict()
  .showHelpOnFail(false)
  .parse()
