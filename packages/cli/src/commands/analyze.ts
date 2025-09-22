import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import {
  runCodeQL,
} from '../codeql'
import { getContext } from '../context'

export async function analyzeProject(): Promise<void> {
  debug('Starting analysis')

  const ctx = getContext()

  try {
    if (ctx.isRemote()) {
      // Checkout from remote repository
      const projectUrl = ctx.getRepository()
      const branch = ctx.getBranch()

      debug('Checking out repository: %s', projectUrl)
      debug('Branch: %s', branch)

      await checkoutRepository()

      debug('Repository checked out')
    }

    await runCodeQL()

    // Step 6: Upload to server (to be implemented)
    debug('Analysis completed successfully!')
  } catch (error) {
    debug('Analysis failed: %o', error)
    throw error
  }
}
