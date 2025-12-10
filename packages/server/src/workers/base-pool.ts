import Piscina from 'piscina'
import path from 'node:path'

export interface WorkerPoolOptions {
  filename: string
  idleTimeout?: number
  maxThreads?: number
  minThreads?: number
  workerData?: any
}

export abstract class BaseWorkerPool {
  protected pool: Piscina | null = null
  protected options: WorkerPoolOptions

  constructor(options: WorkerPoolOptions) {
    this.options = options
    this.initializePool()
  }

  protected initializePool() {
    this.pool = new Piscina({
      filename: this.options.filename,
      maxThreads: this.options.maxThreads ?? 2,
      minThreads: this.options.minThreads ?? 0,
      idleTimeout: this.options.idleTimeout ?? 60000,
      maxQueue: 5,
      workerData: this.options.workerData,
    })
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
      runTime: this.pool.runTime,
      // waitCount: this.pool.waitCount, // Not available in types
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

  protected getPoolOrThrow(): Piscina {
    if (!this.pool) {
      throw new Error('Worker pool not initialized')
    }
    return this.pool
  }
}
