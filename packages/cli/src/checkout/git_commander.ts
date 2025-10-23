import { rmSync } from 'node:fs'
import run from '../utils/run'
import { ensureDirectoryExistsSync } from '../utils/fs-helper'

interface IGitCommander {
  fetch(
    refSpec: string[],
    options: {
      fetchDepth?: number
      fetchTags?: boolean
      showProgress?: boolean
    },
  ): Promise<void>
  getWorkingDirectory(): string
  init(): Promise<void>
  remoteAdd(remoteName: string, remoteUrl: string): Promise<void>
  tryDisableAutomaticGarbageCollection(): Promise<boolean>
  version(): Promise<string>
  checkout(ref: string): Promise<void>
  cleanup(): Promise<void>
}

export async function createCommandManager(workingDirectory: string): Promise<IGitCommander> {
  ensureDirectoryExistsSync(workingDirectory)
  return await GitCommander.createCommandManager(workingDirectory)
}

class GitCommander implements IGitCommander {
  private workingDirectory: string

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory
  }

  async fetch(
    refSpec: string[],
    options: {
      fetchDepth?: number
      fetchTags?: boolean
      showProgress?: boolean
    },
  ): Promise<void> {
    const gitArgs = ['fetch']
    if (options.fetchDepth) {
      gitArgs.push('--depth', options.fetchDepth.toString())
    }
    if (options.fetchTags) {
      gitArgs.push('--tags')
    }
    if (options.showProgress) {
      gitArgs.push('--progress')
    }

    gitArgs.push('origin')
    for (const arg of refSpec) {
      gitArgs.push(arg)
    }

    await run('git', gitArgs, { cwd: this.workingDirectory })
  }

  getWorkingDirectory(): string {
    return this.workingDirectory
  }

  async init(): Promise<void> {
    await run('git', ['init'], { cwd: this.workingDirectory })
  }
  async remoteAdd(remoteName: string, remoteUrl: string): Promise<void> {
    if (process.env.GIT_TOKEN_NAME && process.env.GIT_TOKEN_VALUE) {
      const url = new URL(remoteUrl)
      url.username = process.env.GIT_TOKEN_NAME
      url.password = process.env.GIT_TOKEN_VALUE
      remoteUrl = url.toString()
    }
    await run('git', ['remote', 'add', remoteName, remoteUrl], { cwd: this.workingDirectory })
  }

  async tryDisableAutomaticGarbageCollection(): Promise<boolean> {
    const gitArgs = ['config', '--global', 'gc.auto', '0']

    try {
      await run('git', gitArgs, { cwd: this.workingDirectory })
      return true
    } catch (error) {
      return false
    }
  }

  async version(): Promise<string> {
    const result = await run('git', ['version'], { cwd: this.workingDirectory }, true)
    return result
  }

  async checkout(ref: string): Promise<void> {
    const args = ['checkout', '--progress', '--force']

    args.push(ref)

    await run('git', args, { cwd: this.workingDirectory })
  }

  async cleanup(): Promise<void> {
    rmSync(this.workingDirectory, { recursive: true })
  }

  static async createCommandManager(workingDirectory: string): Promise<IGitCommander> {
    return new GitCommander(workingDirectory)
  }
}
