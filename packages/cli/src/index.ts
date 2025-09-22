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
      }, analyzeProject)
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .strict()
  .parse()
