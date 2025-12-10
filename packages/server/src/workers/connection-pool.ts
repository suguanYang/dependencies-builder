import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as repository from '../database/repository'
import { BaseWorkerPool } from './base-pool'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionWorkerPool: ConnectionWorkerPool | null = null

/**
 * Worker pool for connection auto-creation tasks
 */
export class ConnectionWorkerPool extends BaseWorkerPool {
    executionAbortControllers = new Map<string, AbortController>()

    constructor() {
        super({
            filename: path.resolve(
                __dirname,
                process.env.NODE_ENV === 'production' ? 'connection-worker.js' : 'worker-wrapper.js',
            ),
            maxThreads: 2,
            minThreads: 1,
            idleTimeout: 60000,
            workerData: {
                fullpath: path.resolve(__dirname, 'connection-worker.ts'),
            },
        })
    }

    /**
     * Execute connection auto-creation in a worker thread
     */
    async executeConnectionAutoCreation(actionId: string): Promise<{
        success: boolean
        result?: any
        error?: string
    }> {
        const pool = this.getPoolOrThrow()

        try {
            const abortController = new AbortController()
            this.executionAbortControllers.set(actionId, abortController)
            const result = await pool.run({ actionId }, { signal: abortController.signal })
            return result
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }
    }

    stopExecution(actionId: string) {
        const abortController = this.executionAbortControllers.get(actionId)
        if (abortController) {
            abortController.abort()
            this.executionAbortControllers.delete(actionId)
            repository.updateAction(actionId, {
                status: 'failed',
            })
            return true
        }

        return false
    }

    static getPool() {
        if (!connectionWorkerPool) {
            connectionWorkerPool = new ConnectionWorkerPool()
        }

        return connectionWorkerPool
    }
}
