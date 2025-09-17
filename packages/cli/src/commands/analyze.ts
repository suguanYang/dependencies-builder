import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import {
  initializeCodeQL,
  createCodeQLDatabase,
  runCodeQLQueries,
  interpretCodeQLResults,
} from '../codeql'
import { getContext } from '../context'

export async function analyzeProject(): Promise<void> {
  debug('Starting analysis')

  const ctx = getContext()

  try {
    let repoPath: string

    if (ctx.hasLocalRepoPath()) {
      // Use local repository path directly
      repoPath = ctx.getLocalRepoPath()!
      debug('Using local repository path: %s', repoPath)
    } else {
      // Checkout from remote repository
      const projectUrl = ctx.getProjectUrl()!
      const branch = ctx.getBranch()

      debug('Checking out repository: %s', projectUrl)
      debug('Branch: %s', branch)

      repoPath = await checkoutRepository()

      debug('Repository checked out to: %s', repoPath)
    }

    // Step 2: Initialize CodeQL environment
    await initializeCodeQL()

    // Step 3: Create CodeQL database
    const databasePath = await createCodeQLDatabase()

    // Step 4: Run CodeQL queries
    const resultsPath = await runCodeQLQueries(databasePath)

    // Step 5: Interpret results
    await interpretCodeQLResults(resultsPath)

    // Step 6: Upload to server (to be implemented)
    debug('Analysis completed successfully!')
    debug('Results available in: /tmp/analysis-results')
  } catch (error) {
    debug('Analysis failed: %o', error)
    throw error
  }
}
