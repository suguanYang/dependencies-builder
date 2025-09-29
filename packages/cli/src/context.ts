import os from 'node:os';
import { join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks'

import { existsSync } from './utils/fs-helper';
import { readFileSync } from 'node:fs';

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
}

class Context {
    private metadata?: METADATA
    private type?: REPO_TYPE
    private remote: boolean = false;
    private tmpDir: string
    private options: AnalyzeOptions

    constructor(options: AnalyzeOptions) {
        this.options = options
        this.tmpDir = getOutputDir()
    }

    getRepository(): string {
        if (this.remote) {
            return this.tmpDir
        }
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

    getMetadata(): METADATA {
        return this.metadata!
    }

    setup(): void {
        if (!this.options.repository) {
            throw new Error('Repository must be provided')
        }

        if (this.options.repository.startsWith('http')) {
            this.remote = true
        } else if (!existsSync(this.options.repository)) {
            throw new Error('Repository must be a existing local directory')
        }

        if (!existsSync(join(this.options.repository, 'package.json'))) {
            throw new Error('Package.json not found')
        }

        try {
            this.metadata = JSON.parse(readFileSync(join(this.getRepository(), 'package.json'), 'utf-8')) as METADATA
        } catch (error) {
            throw new Error(`Failed to parse package.json: ${error}`)
        }

        if (this.getRepository().includes('libs')) {
            this.type = 'lib'
        } else {
            this.type = 'app'
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