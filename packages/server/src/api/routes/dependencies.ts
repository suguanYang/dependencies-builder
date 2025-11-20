import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import * as dependencyManager from '../../dependency'
import { authenticate } from '../../auth/middleware'

function dependenciesRoutes(fastify: FastifyInstance) {
  // GET /dependencies/nodes/:nodeId - Get dependency graph for a specific node (recursive)
  fastify.get('/dependencies/nodes/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string }

      // Get all nodes and edges for the graph
      const nodesResult = await repository.getNodes({})
      const connectionsResult = await repository.getConnections({})

      const graph = dependencyManager.getNodeDependencyGraph(
        nodeId,
        nodesResult.data,
        connectionsResult.data,
      )

      return graph
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          error: 'Node not found',
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

      // Get all nodes and edges
      const nodesResult = await repository.getNodes({})
      const connectionsResult = await repository.getConnections({})

      const graph = dependencyManager.getProjectLevelDependencyGraph(
        projectId,
        nodesResult.data,
        connectionsResult.data,
      )

      return graph
    } catch (error) {
      if (error instanceof Error && error.message.includes('No nodes found')) {
        reply.code(404).send({
          error: 'Project not found',
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

      // Get all nodes and edges
      const nodesResult = await repository.getNodes({})
      const connectionsResult = await repository.getConnections({})

      const graph = dependencyManager.getProjectDependencyGraph(
        projectName,
        branch,
        nodesResult.data,
        connectionsResult.data,
      )

      return graph
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch project dependency graph',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
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

        const isValid = dependencyManager.validateEdgeCreation(fromNode, toNode)

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
