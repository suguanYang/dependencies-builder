import { FastifyInstance } from 'fastify';
import * as repository from '../../database/repository';
import * as dependencyManager from '../../dependency';

function dependenciesRoutes(
  fastify: FastifyInstance,
) {
  // GET /dependencies/:nodeId - Get dependency graph for a node
  fastify.get('/dependencies/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string };

      // Get all nodes and edges for the graph
      const nodesResult = await repository.getNodes({ take: 0 });
      const connectionsResult = await repository.getConnections({ take: 0 });

      const graph = dependencyManager.getFullDependencyGraph(
        nodeId,
        nodesResult.data,
        connectionsResult.data
      );

      return graph;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch dependency graph', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /dependencies/validate - Validate edge creation
  fastify.post('/dependencies/validate', async (request, reply) => {
    try {
      const { fromId, toId } = request.body as { fromId: string; toId: string };

      const fromNode = await repository.getNodeById(fromId);
      const toNode = await repository.getNodeById(toId);

      if (!fromNode || !toNode) {
        reply.code(404).send({ error: 'One or both nodes not found' });
        return;
      }

      const isValid = dependencyManager.validateEdgeCreation(fromNode, toNode);

      return { valid: isValid };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to validate dependency', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /dependencies/circular/:nodeId - Check for circular dependencies
  fastify.get('/dependencies/circular/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string };

      const connectionsResult = await repository.getConnections({ take: 0 });
      const cycles = dependencyManager.findCircularDependencies(connectionsResult.data);

      return { cycles };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to check circular dependencies', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}

export default dependenciesRoutes;