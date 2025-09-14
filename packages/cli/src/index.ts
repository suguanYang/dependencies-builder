import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { enable } from './utils/debug'

yargs(hideBin(process.argv))
  .command(
    'analyze <project> [branch]',
    'Analyze a project repository for dependencies',
    (yargs) => {
      return yargs
        .positional('project', {
          describe: 'Git repository URL to analyze',
          type: 'string',
          demandOption: true,
        })
        .positional('branch', {
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
    },
    async (argv) => {
      const { analyzeProject } = await import('./commands/analyze')
      if (argv.verbose) {
        enable()
      }
      await analyzeProject({
        projectUrl: argv.project,
        branch: argv.branch,
      })
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .strict()
  .parse()
