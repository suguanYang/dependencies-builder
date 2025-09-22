import debug from '../utils/debug'
import { RepositorySetupFailedException } from '../exceptions'
import { createCommandManager } from './git_commander'
import { getContext } from '../context'

export interface CheckoutOptions {
  url: string
  branch: string
  authToken?: string
}

export async function checkoutRepository() {
  const ctx = getContext()
  const url = ctx.getRepository()
  const branch = ctx.getBranch()

  const gitCommander = await createCommandManager(ctx.getRepository())

  debug('Cloning repository: %s#%s to %s', url, branch, ctx.getRepository())

  try {
    await gitCommander.init()
    await gitCommander.remoteAdd('origin', url)
    await gitCommander.tryDisableAutomaticGarbageCollection()
    await gitCommander.fetch([`${branch}:${branch}`], { fetchDepth: 1, showProgress: true })
  } catch (error) {
    throw new RepositorySetupFailedException(`Failed to clone repository: ${error}`)
  } finally {
    await gitCommander.cleanup()
  }
}
