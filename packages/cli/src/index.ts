import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { enable } from './utils/debug'
import { runWithContext } from './context'

yargs(hideBin(process.argv))
  .command(
    'analyze [project] [branch]',
    'Analyze a project repository for dependencies',
    (yargs) => {
      return yargs
        .positional('project', {
          describe: 'Git repository URL to analyze',
          type: 'string',
        })
        .positional('branch', {
          describe: 'Branch name to analyze',
          type: 'string',
          default: 'main',
        })
        .option('local-repo-path', {
          alias: 'l',
          describe: 'Path to local repository directory',
          type: 'string',
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
        projectUrl: argv.project,
        branch: argv.branch,
        localRepoPath: argv.localRepoPath,
      }, analyzeProject)
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .strict()
  .parse()
