import { FastifyInstance } from 'fastify';
import { DatabaseManager } from '../database/manager';
import { NodeRepository, EdgeRepository } from '../database/repository';
import { DependencyManager } from '../dependency';
import { nodesRoutes } from './routes/nodes';
import { edgesRoutes } from './routes/edges';
import { dependenciesRoutes } from './routes/dependencies';

export async function setupAPI(fastify: FastifyInstance, dbManager: DatabaseManager) {
  // Initialize repositories
  const nodeRepository = new NodeRepository(dbManager);
  const edgeRepository = new EdgeRepository(dbManager);
  const dependencyManager = new DependencyManager();

  // Register routes
  nodesRoutes(fastify, nodeRepository);
  edgesRoutes(fastify, edgeRepository);
  dependenciesRoutes(fastify, nodeRepository, edgeRepository, dependencyManager);

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const dbHealthy = await dbManager.healthCheck();
    return {
      status: 'OK',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    };
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