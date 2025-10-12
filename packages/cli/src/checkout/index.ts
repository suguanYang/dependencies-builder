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

  const gitCommander = await createCommandManager(ctx.getWorkingDirectory())

  debug('Cloning repository: %s#%s to %s', url, branch, ctx.getWorkingDirectory())

  try {
    await gitCommander.init()
    await gitCommander.remoteAdd('origin', url)
    await gitCommander.tryDisableAutomaticGarbageCollection()
    await gitCommander.fetch([`${branch}:${branch}`], { fetchDepth: ctx.getTargetBranch() ? 0 : 1, showProgress: true })

    if (ctx.getTargetBranch()) {
      await gitCommander.fetch([`${ctx.getTargetBranch()}:${ctx.getTargetBranch()}`], { fetchDepth: 0, showProgress: true })
    }

    await gitCommander.checkout(branch)
  } catch (error) {
    throw new RepositorySetupFailedException(`Failed to clone repository: ${error}`)
  }
}
