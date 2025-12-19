import { FastifyInstance } from 'fastify'
import { DependencyBuilderWorkerPool } from '../../workers/dependency-builder-pool'
import { error } from '../../logging'
import { cache } from '../../cache/instance'

// Custom error class for not found errors
class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

// Helper function to check if error is a not found error
const isNotFoundError = (error: unknown): error is NotFoundError => {
  return (
    error instanceof Error &&
    (error.name === 'NotFoundError' || error.message.includes('not found'))
  )
}

function dependenciesRoutes(fastify: FastifyInstance) {
  // GET /dependencies/nodes/:nodeId - Get dependency graph for a specific node (recursive)
  fastify.get('/dependencies/nodes/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string }
      const { depth } = request.query as { depth?: number }

      const graphJson = await DependencyBuilderWorkerPool.getPool().getNodeDependencyGraph(nodeId, {
        depth,
      })

      // Send raw JSON string directly
      reply.header('Content-Type', 'application/json').send(graphJson)
    } catch (error) {
      if (isNotFoundError(error)) {
        reply.code(404).send({
          error: 'No dependency found',
          details: error.message,
        })
      } else {
        reply.code(500).send({
          error: 'Failed to fetch node dependency graph',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  // GET /dependencies/projects/:projectId - Get project-level dependency graph
  fastify.get('/dependencies/projects/:projectId/:branch', async (request, reply) => {
    try {
      const { projectId, branch } = request.params as { projectId: string; branch: string }
      const { depth } = request.query as { depth?: number }

      const useCache = projectId === '*'
      const cacheKey = `projects/graphs/${branch}`

      // Cache-first strategy: check cache before calling worker
      if (useCache) {
        const cacheExists = await cache.has(cacheKey)
        if (cacheExists) {
          // Stream cached file directly to HTTP response
          const readStream = cache.createReadStream(cacheKey)

          reply.header('Content-Type', 'application/json')
          return reply.send(readStream)
        }
      }

      // Cache miss: fetch from worker (returns ArrayBuffer)
      const result = await DependencyBuilderWorkerPool.getPool().getProjectLevelDependencyGraph(
        projectId,
        branch,
        {
          depth,
        },
      )

      // Write to cache asynchronously (fire and forget)
      if (useCache) {
        cache.set(cacheKey, result).catch((e) => {
          console.warn(`Failed to write cache: ${e}`)
        })
      }

      // Send Buffer directly to response (more efficient than converting to string)
      reply.header('Content-Type', 'application/json').send(result)
    } catch (err) {
      error(err)
      if (isNotFoundError(err)) {
        reply.code(404).send({
          error: 'No dependency found',
          details: err.message,
        })
      } else {
        reply.code(500).send({
          error: 'Failed to fetch project-level dependency graph',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  })
}

export default dependenciesRoutes
