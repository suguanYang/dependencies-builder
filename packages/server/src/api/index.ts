import { FastifyInstance } from 'fastify';
import nodesRoutes from './routes/nodes';
import connectionsRoutes from './routes/connections';
import { dependenciesRoutes } from './routes/dependencies';
import { prisma } from '../database/prisma';

export async function setupAPI(fastify: FastifyInstance) {
  // Register routes
  fastify.register(nodesRoutes);
  fastify.register(connectionsRoutes);
  fastify.register(dependenciesRoutes);

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    try {
      // Simple health check - try to count nodes
      await prisma.node.count();
      return {
        status: 'OK',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return {
      message: 'DMS Server API',
      version: '1.0.0',
      endpoints: [
        '/nodes',
        '/nodes/:id',
        '/edges',
        '/edges/:id',
        '/dependencies/:nodeId',
        '/health'
      ]
    };
  });
}