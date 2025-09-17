import { AsyncLocalStorage } from 'node:async_hooks'

export interface AnalyzeOptions {
    projectUrl?: string
    branch?: string
    localRepoPath?: string
}

class Context {
    private options: AnalyzeOptions

    constructor(options: AnalyzeOptions) {
        this.options = options
    }

    getProjectUrl(): string | undefined {
        return this.options.projectUrl
    }

    getBranch(): string {
        return this.options.branch || 'main'
    }

    getLocalRepoPath(): string | undefined {
        return this.options.localRepoPath
    }

    hasLocalRepoPath(): boolean {
        return !!this.options.localRepoPath
    }

    hasProjectUrl(): boolean {
        return !!this.options.projectUrl
    }

    validate(): void {
        if (!this.hasLocalRepoPath() && !this.hasProjectUrl()) {
            throw new Error('Either project URL or local repository path must be provided')
        }

        if (this.hasLocalRepoPath() && this.hasProjectUrl()) {
            throw new Error('Cannot specify both project URL and local repository path')
        }

        if (this.hasProjectUrl() && !this.getBranch()) {
            throw new Error('Branch must be specified when using project URL')
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
    context.validate()
    return contextStorage.run(context, fn)
}