import Piscina from 'piscina'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import * as repository from '../database/repository'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Worker pool for connection auto-creation tasks
 * Uses piscina to manage worker threads efficiently
 */
export class ConnectionWorkerPool {
  executionAbortControllers = new Map<string, AbortController>()
  private pool: Piscina | null = null

  constructor() {
    this.initializePool()
  }

  private initializePool() {
    this.pool = new Piscina({
      filename: path.resolve(
        __dirname,
        process.env.NODE_ENV === 'production' ? 'connection-worker.js' : 'worker-wrapper.js',
      ),
      maxThreads: 2, // Limit to 2 threads to avoid overwhelming the system
      minThreads: 1,
      idleTimeout: 60000, // 1 minute idle timeout
      maxQueue: 5, // Maximum queue size
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
    if (!this.pool) {
      throw new Error('Worker pool not initialized')
    }

    try {
      const abortController = new AbortController()
      this.executionAbortControllers.set(actionId, abortController)
      const result = await this.pool.run({ actionId }, { signal: abortController.signal })
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

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) {
      return null
    }

    return {
      threadCount: this.pool.threads.length,
      queueSize: this.pool.queueSize,
      completed: this.pool.completed,
      duration: this.pool.duration,
    }
  }

  /**
   * Destroy the worker pool
   */
  async destroy() {
    if (this.pool) {
      await this.pool.destroy()
      this.pool = null
    }
  }
}

// Singleton instance
export const connectionWorkerPool = new ConnectionWorkerPool()
