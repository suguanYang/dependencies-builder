import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BaseWorkerPool } from './base-pool'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let dependencyBuilderWorkerPool: DependencyBuilderWorkerPool | null = null

/**
 * Worker pool for dependency building tasks
 */
export class DependencyBuilderWorkerPool extends BaseWorkerPool {
  constructor() {
    super({
      filename: path.resolve(
        __dirname,
        process.env.NODE_ENV === 'production'
          ? 'dependency-builder-worker.js'
          : 'worker-wrapper.js',
      ),
      maxThreads: 4,
      minThreads: 1,
      idleTimeout: 30000,
      workerData: {
        fullpath: path.resolve(__dirname, 'dependency-builder-worker.ts'),
      },
    })
  }

  async getNodeDependencyGraph(nodeId: string, opts?: { depth?: number }): Promise<string> {
    const pool = this.getPoolOrThrow()
    const response = await pool.run({ type: 'GET_NODE_GRAPH', nodeId, opts })

    if (!response.success) {
      throw new Error(response.error || 'Failed to get node dependency graph')
    }
    return response.result
  }

  async getProjectLevelDependencyGraph(
    projectId: string,
    branch: string,
    opts?: { depth?: number },
  ): Promise<string> {
    const pool = this.getPoolOrThrow()
    const response = await pool.run({ type: 'GET_PROJECT_GRAPH', projectId, branch, opts })

    if (!response.success) {
      throw new Error(response.error || 'Failed to get project dependency graph')
    }
    return response.result
  }

  static getPool() {
    if (!dependencyBuilderWorkerPool) {
      dependencyBuilderWorkerPool = new DependencyBuilderWorkerPool()
    }

    return dependencyBuilderWorkerPool
  }
}
