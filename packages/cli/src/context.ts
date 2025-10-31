import os, { homedir } from 'node:os'
import path, { join } from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'

import { ensureDirectoryExistsSync, existsSync } from './utils/fs-helper'
import { readFileSync, readdirSync } from 'node:fs'
import { getProjectByName } from './api'

const path2name = (path: string) => {
  return path.replaceAll('/', '_')
}

type REPO_TYPE = 'App' | 'Lib'

// type of package.json
type METADATA = {
  name: string
  version: string
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export interface AnalyzeOptions {
  branch: string
  type?: REPO_TYPE
  targetBranch?: string
  actionId?: string
  ignoreCallGraph?: boolean
  /**
   * The repository to analyze, it can be a local directory or a remote git repository
   */
  repository: string
  name: string
}

class Context {
  private metadata?: METADATA
  private type?: REPO_TYPE
  private entries?: { name: string; path: string }[]
  private remote: boolean = false
  private tmpDir: string
  private options: AnalyzeOptions
  private localDirectory?: string
  private workDirectory?: string
  private version?: string

  constructor(options: AnalyzeOptions) {
    this.options = options
    this.tmpDir = getOutputDir()
  }

  getWorkingDirectory(): string {
    if (this.workDirectory) {
      return this.workDirectory
    }

    if (this.remote) {
      return this.tmpDir
    }
    return this.options.repository
  }

  getRepositoryDir(): string {
    if (this.remote) {
      return this.tmpDir
    }
    return this.options.repository
  }

  getRepository(): string {
    return this.options.repository
  }

  getBranch(): string {
    return this.options.branch || 'main'
  }

  getTargetBranch(): string | undefined {
    return this.options.targetBranch
  }

  isRemote(): boolean {
    return this.remote
  }

  getType() {
    return this.type!
  }

  setVersion(version: string) {
    this.version = version
  }

  getVersion() {
    return this.version!
  }

  getEntries() {
    return this.entries || []
  }

  getLocalDirectory(branch?: string): string {
    if (branch) {
      return path.join(
        process.env.DMS_LOCAL_DIR ? process.env.DMS_LOCAL_DIR : homedir(),
        '.dms',
        path2name(this.getRepository()),
        path2name(branch),
        path2name(this.options.name),
      )
    }

    return this.localDirectory!
  }

  getMetadata(): METADATA {
    if (this.metadata) {
      return this.metadata
    }

    const workingDir = this.getWorkingDirectory()
    const packageJsonPath = join(workingDir, 'package.json')

    if (!existsSync(packageJsonPath)) {
      throw new Error(`Package.json not found at ${packageJsonPath}`)
    }

    try {
      this.metadata = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as METADATA
    } catch (error) {
      throw new Error(`Failed to parse package.json: ${error}`)
    }

    return this.metadata!
  }

  getActionId() {
    return this.options.actionId
  }

  getIgnoreCallGraph() {
    return this.options.ignoreCallGraph || false
  }

  findPackageDirectory() {
    const packageName = this.options.name
    const baseDir = this.remote ? this.tmpDir : this.options.repository

    // Search for package.json files recursively
    const searchDirectories = [baseDir]
    const visited = new Set<string>()

    while (searchDirectories.length > 0 && visited.size < 200) {
      const currentDir = searchDirectories.pop()!

      if (visited.has(currentDir)) {
        continue
      }
      visited.add(currentDir)

      try {
        const entries = readdirSync(currentDir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name)

          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (
              entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name.startsWith('.')
            ) {
              continue
            }
            const depth = path.relative(baseDir, fullPath).split('/').length
            if (depth > 3) {
              continue
            }
            searchDirectories.push(fullPath)
          } else if (entry.name === 'package.json') {
            try {
              const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'))
              if (packageJson.name === packageName) {
                this.workDirectory = currentDir
                return
              }
            } catch (error) {
              // Skip invalid package.json files
              continue
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
        continue
      }
    }

    throw new Error(`Package '${packageName}' not found in repository`)
  }

  toString() {
    return JSON.stringify({
      options: this.options,
      localDirectory: this.getLocalDirectory(),
      version: this.getVersion(),
      entries: this.getEntries(),
      workingDir: this.getWorkingDirectory()
    })
  }

  async setup() {
    if (!this.options.repository) {
      throw new Error('Repository must be provided')
    }

    if (this.options.repository.startsWith('http') || this.options.repository.startsWith('git')) {
      this.remote = true
    } else if (!existsSync(this.options.repository)) {
      throw new Error('Repository must be a existing local directory')
    }

    this.localDirectory = path.join(
      process.env.DMS_LOCAL_DIR ? process.env.DMS_LOCAL_DIR : homedir(),
      '.dms',
      path2name(this.getRepository()),
      path2name(this.getBranch()),
      path2name(this.options.name),
    )
    ensureDirectoryExistsSync(this.localDirectory)

    if (this.options.type) {
      this.type = this.options.type
      return
    }

    const project = await getProjectByName(this.options.name)

    this.type = project.type
    this.entries = project.entries
  }
}

// AsyncLocalStorage instance for context management
const contextStorage = new AsyncLocalStorage<Context>()

// Get the current context from async storage
export function getContext(): Context {
  const context = contextStorage.getStore()
  if (!context) {
    throw new Error('Context not found in async storage. Make sure to run within context.run()')
  }
  return context
}

// Run a function with context in async storage
export async function runWithContext<T>(options: AnalyzeOptions, fn: () => T): Promise<T> {
  const context = new Context(options)
  await context.setup()

  return contextStorage.run(context, fn)
}

// generate a random tmp dir
function getOutputDir(): string {
  return join(os.tmpdir(), `dependency-analyzer-${Date.now()}`)
}
