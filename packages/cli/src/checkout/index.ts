import { join } from 'node:path'
import debug from '../utils/debug'
import { directoryExistsSync, ensureDirectoryExistsSync, existsSync } from '../utils/fs-helper'
import { RepositoryAlreadyExistsException, RepositorySetupFailedException } from '../exceptions'
import os from 'node:os'
import { createCommandManager } from './git_commander'
import { getContext } from '../context'

export interface CheckoutOptions {
  url: string
  branch: string
  authToken?: string
}

export async function checkoutRepository(): Promise<string> {
  const ctx = getContext()
  const url = ctx.getProjectUrl()!
  const branch = ctx.getBranch()

  const outputDir = getOutputDir()

  if (directoryExistsSync(outputDir)) {
    debug('Repository already exists at: %s', outputDir)
    throw new RepositoryAlreadyExistsException(`Repository already exists at: ${outputDir}`)
  }

  ensureDirectoryExistsSync(outputDir)

  const gitCommander = await createCommandManager(outputDir)


  debug('Cloning repository: %s#%s to %s', url, branch, outputDir)

  try {
    await gitCommander.init()
    await gitCommander.remoteAdd('origin', url)
    await gitCommander.tryDisableAutomaticGarbageCollection()
    await gitCommander.fetch([`${branch}:${branch}`], { fetchDepth: 1, showProgress: true })

    return gitCommander.getWorkingDirectory()
  } catch (error) {
    throw new RepositorySetupFailedException(`Failed to clone repository: ${error}`)
  } finally {
    await gitCommander.cleanup()
  }
}

// generate a random tmp dir
function getOutputDir(): string {
  return join(os.tmpdir(), `dependency-analyzer-${Date.now()}`)
}