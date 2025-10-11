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
          default: 'main',
        })
        .option('verbose', {
          alias: 'v',
          describe: 'Enable verbose output',
          type: 'boolean',
          default: false,
        })
        .option('type', {
          describe: 'Type of the project',
          type: 'string',
        })
        .conflicts('project', 'local-repo-path')
    },
    async (argv) => {
      const { analyzeProject } = await import('./commands/analyze')
      if (argv.verbose) {
        enable()
      }

      await runWithContext({
        branch: argv.branch,
        repository: argv.repository,
        type: argv.type as 'app' | 'lib',
      }, analyzeProject)
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
        .option('type', {
          describe: 'Type of the project',
          type: 'string',
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

      await runWithContext({
        branch: argv.branch,
        repository: argv.repository,
        type: argv.type as 'app' | 'lib',
      }, () => generateReport(argv.targetBranch))
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .strict()
  .showHelpOnFail(false)
  .parse()
