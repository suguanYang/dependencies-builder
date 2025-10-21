import { FastifyInstance } from 'fastify'
import nodesRoutes from './routes/nodes'
import connectionsRoutes from './routes/connections'
import dependenciesRoutes from './routes/dependencies'
import actionsRoutes from './routes/actions'
import projectsRoutes from './routes/projects'
import { prisma } from '../database/prisma'

export async function setupAPI(fastify: FastifyInstance) {
  // Register routes
  fastify.register(nodesRoutes)
  fastify.register(connectionsRoutes)
  fastify.register(dependenciesRoutes)
  fastify.register(actionsRoutes)
  fastify.register(projectsRoutes)

  // Health check endpoint
  fastify.get('/health', async () => {
    try {
      // Simple health check - try to count nodes
      await prisma.node.count()
      return {
        status: 'OK',
        database: 'connected',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        status: 'ERROR',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Root endpoint
  fastify.get('/', async () => {
    return {
      message: 'DMS Server API',
      version: '1.0.0',
      endpoints: [
        '/nodes',
        '/nodes/:id',
        '/edges',
        '/edges/:id',
        '/dependencies/:nodeId',
        '/actions',
        '/actions/:id',
        '/actions/:id/result',
        '/actions/:id/stream',
        '/actions/:id/stop',
        '/projects',
        '/projects/:id',
        '/projects/name/:name',
        '/health',
      ],
    }
  })
}
