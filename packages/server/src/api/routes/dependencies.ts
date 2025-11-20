import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import * as dependencyManager from '../../dependency'
import { GraphNode } from '../../dependency/types'
import { authenticate } from '../../auth/middleware'

// Custom error class for not found errors
class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

// Helper function to check if error is a not found error
const isNotFoundError = (error: unknown): error is NotFoundError => {
  return error instanceof Error &&
    (error.name === 'NotFoundError' || error.message.includes('not found'))
}

function dependenciesRoutes(fastify: FastifyInstance) {
  // GET /dependencies/nodes/:nodeId - Get dependency graph for a specific node (recursive)
  fastify.get('/dependencies/nodes/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string }

      const graph = await dependencyManager.getNodeDependencyGraph(nodeId)

      return graph
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
  fastify.get('/dependencies/projects/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string }

      const graph = await dependencyManager.getProjectLevelDependencyGraph(projectId)

      return graph
    } catch (error) {
      if (isNotFoundError(error)) {
        reply.code(404).send({
          error: 'No dependency found',
          details: error.message,
        })
      } else {
        reply.code(500).send({
          error: 'Failed to fetch project-level dependency graph',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  // GET /dependencies/projects/:projectName/:branch - Get project dependency graph (existing endpoint)
  fastify.get('/dependencies/projects/:projectName/:branch', async (request, reply) => {
    try {
      const { projectName, branch } = request.params as { projectName: string; branch: string }

      // Get nodes and connections for the specific project and branch
      const nodesResult = await repository.getNodes({
        where: { projectName, branch }
      })

      // Get connections involving these nodes
      const nodeIds = nodesResult.data.map(node => node.id)
      const connectionsResult = await repository.getConnections({
        where: {
          OR: [
            { fromId: { in: nodeIds } },
            { toId: { in: nodeIds } }
          ]
        }
      })

      const graph = dependencyManager.getProjectDependencyGraph(
        projectName,
        branch,
        nodesResult.data,
        connectionsResult.data,
      )

      return graph
    } catch (error) {
      if (isNotFoundError(error)) {
        reply.code(404).send({
          error: 'Project not found',
          details: error.message,
        })
      } else {
        reply.code(500).send({
          error: 'Failed to fetch project dependency graph',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  // POST /dependencies/validate - Validate edge creation
  fastify.post(
    '/dependencies/validate',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { fromId, toId } = request.body as { fromId: string; toId: string }

        const fromNode = await repository.getNodeById(fromId)
        const toNode = await repository.getNodeById(toId)

        if (!fromNode || !toNode) {
          reply.code(404).send({ error: 'One or both nodes not found' })
          return
        }

        // Convert to GraphNode format
        const fromGraphNode: GraphNode = {
          ...fromNode,
          createdAt: fromNode.createdAt.toISOString(),
          updatedAt: fromNode.updatedAt.toISOString(),
        }
        const toGraphNode: GraphNode = {
          ...toNode,
          createdAt: toNode.createdAt.toISOString(),
          updatedAt: toNode.updatedAt.toISOString(),
        }

        const isValid = dependencyManager.validateEdgeCreation(fromGraphNode, toGraphNode)

        return { valid: isValid }
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to validate dependency',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )
}

export default dependenciesRoutes
