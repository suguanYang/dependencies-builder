import { join } from 'node:path'
import run from '../utils/run'
import debug from '../utils/debug'
import { getContext } from '../context'

const CODE_QL_EXCUTABLE_PATH = process.env.CODEQL_EXCUTABLE_PATH || '/usr/local/codeql/codeql';

export async function initializeCodeQL(): Promise<void> {
  debug('Initializing CodeQL environment...')

  try {
    const versionString = await run(CODE_QL_EXCUTABLE_PATH, ['version', '--format=json'], {}, true)
    const version = JSON.parse(versionString)
    debug('CodeQL version: %s', version.version)
  } catch (error) {
    throw new Error('CodeQL CLI not found. Please install CodeQL and add it to PATH')
  }

  // check javascript language support
  // /opt/hostedtoolcache/CodeQL/2.23.0/x64/codeql/codeql resolve languages --format=betterjson --extractor-options-verbosity=4 --extractor-include-aliases
  try {
    const languagesString = await run(CODE_QL_EXCUTABLE_PATH, ['resolve', 'languages', '--format=betterjson', '--extractor-options-verbosity=4', '--extractor-include-aliases'], {}, true)
    const languages = JSON.parse(languagesString)
  } catch (error) {
    throw new Error(`Failed to check CodeQL languages: ${error}`)
  }
}

export async function createCodeQLDatabase(): Promise<string> {
  const ctx = getContext()
  const repoPath = ctx.getLocalRepoPath()!
  const outputDir = '/tmp/analysis-results' // TODO: Make this configurable via context

  const databasePath = join(outputDir, 'codeql-database')

  debug('Creating CodeQL database...')

  try {
    await run('codeql', [
      'database',
      'create',
      databasePath,
      '--language=javascript',
      `--source-root=${repoPath}`,
      '--overwrite',
    ])
    return databasePath
  } catch (error) {
    throw new Error(`Failed to create CodeQL database: ${error}`)
  }
}

export async function runCodeQLQueries(databasePath: string): Promise<string> {
  const ctx = getContext()
  const outputDir = '/tmp/analysis-results' // TODO: Make this configurable via context

  const resultsPath = join(outputDir, 'codeql-results.bqrs')

  debug('Running CodeQL queries...')

  try {
    await run('codeql', [
      'database',
      'analyze',
      databasePath,
      '--format=bqrs',
      `--output=${resultsPath}`,
      'javascript-security-and-quality.qls',
    ])
    return resultsPath
  } catch (error) {
    throw new Error(`Failed to run CodeQL queries: ${error}`)
  }
}

export async function interpretCodeQLResults(resultsPath: string): Promise<any> {
  debug('Interpreting CodeQL results...')

  try {
    const jsonResults = await run(
      'codeql',
      ['bqrs', 'decode', '--format=json', resultsPath],
      undefined,
      true,
    )

    const results = JSON.parse(jsonResults)

    debug('Found %d results to interpret', results.tuples?.length || 0)
    return results
  } catch (error) {
    throw new Error(`Failed to interpret results: ${error}`)
  }
}
