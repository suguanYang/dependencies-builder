import os, { homedir } from 'node:os';
import path, { join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks'

import { ensureDirectoryExistsSync, existsSync } from './utils/fs-helper';
import { readFileSync } from 'node:fs';

const path2name = (path: string) => {
    return path.replaceAll('/', '_')
}

type REPO_TYPE = 'app' | 'lib'

// type of package.json
type METADATA = {
    name: string
    version: string
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
    devDependencies: Record<string, string>
}

export interface AnalyzeOptions {
    branch?: string
    /**
     * The repository to analyze, it can be a local directory or a remote git repository
     */
    repository: string
    type?: REPO_TYPE
}

class Context {
    private metadata?: METADATA
    private type?: REPO_TYPE
    private remote: boolean = false;
    private tmpDir: string
    private options: AnalyzeOptions
    private localDirectory?: string

    constructor(options: AnalyzeOptions) {
        this.options = options
        this.tmpDir = getOutputDir()
    }

    getWorkingDirectory(): string {
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

    isRemote(): boolean {
        return this.remote
    }

    getType(): REPO_TYPE {
        return this.type!
    }

    getLocalDirectory(branch?: string): string {
        if (branch) {
            return path.join(homedir(), '.dms', path2name(this.getRepository()), path2name(branch))
        }

        return this.localDirectory!
    }

    getMetadata(): METADATA {
        if (this.metadata) {
            return this.metadata
        }

        if (!existsSync(join(this.getWorkingDirectory(), 'package.json'))) {
            throw new Error('Package.json not found')
        }

        try {
            this.metadata = JSON.parse(readFileSync(join(this.getWorkingDirectory(), 'package.json'), 'utf-8')) as METADATA
        } catch (error) {
            throw new Error(`Failed to parse package.json: ${error}`)
        }

        return this.metadata!
    }

    setup(): void {
        if (!this.options.repository) {
            throw new Error('Repository must be provided')
        }

        if (this.options.repository.startsWith('http') || this.options.repository.startsWith('git')) {
            this.remote = true
        } else if (!existsSync(this.options.repository)) {
            throw new Error('Repository must be a existing local directory')
        }

        this.localDirectory = path.join(homedir(), '.dms', path2name(this.getRepository()), path2name(this.getBranch()))
        ensureDirectoryExistsSync(this.localDirectory)

        if (this.options.type) {
            this.type = this.options.type
            return
        }

        if (this.options.repository.includes('apps')) {
            this.type = 'app'
        } else {
            this.type = 'lib'
        }
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
export function runWithContext<T>(options: AnalyzeOptions, fn: () => T): T {
    const context = new Context(options)
    context.setup()

    return contextStorage.run(context, fn)
}

// generate a random tmp dir
function getOutputDir(): string {
    return join(os.tmpdir(), `dependency-analyzer-${Date.now()}`)
}