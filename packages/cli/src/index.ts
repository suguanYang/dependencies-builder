import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .command(
    'analyze <project> [branch]',
    'Analyze a project repository for dependencies',
    (yargs) => {
      return yargs
        .positional('project', {
          describe: 'Git repository URL to analyze',
          type: 'string',
          demandOption: true
        })
        .positional('branch', {
          describe: 'Branch name to analyze',
          type: 'string',
          default: 'main'
        })
        .option('output', {
          alias: 'o',
          describe: 'Output directory for analysis results',
          type: 'string',
          default: './analysis-results'
        })
        .option('verbose', {
          alias: 'v',
          describe: 'Enable verbose output',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      const { analyzeProject } = await import('./commands/analyze');
      await analyzeProject({
        projectUrl: argv.project,
        branch: argv.branch,
        outputDir: argv.output,
        verbose: argv.verbose
      });
    }
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('help', 'h')
  .parse();