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
      maxThreads: 1, // Single threaded as requested
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
  async executeConnectionAutoCreation(): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    const pool = this.getPoolOrThrow()

    try {
      // No arguments passed to worker
      const result = await pool.run({})
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // stopExecution removed as we don't track by actionId anymore

  static getPool() {
    if (!connectionWorkerPool) {
      connectionWorkerPool = new ConnectionWorkerPool()
    }

    return connectionWorkerPool
  }
}
