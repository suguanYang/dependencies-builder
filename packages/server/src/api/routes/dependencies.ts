import { FastifyInstance } from 'fastify';
import { NodeRepository, EdgeRepository } from '../../database/repository';
import { DependencyManager } from '../../dependency';

export function dependenciesRoutes(
  fastify: FastifyInstance,
  nodeRepository: NodeRepository,
  edgeRepository: EdgeRepository,
  dependencyManager: DependencyManager
) {
  // GET /dependencies/:nodeId - Get dependency graph for a node
  fastify.get('/dependencies/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string };
      
      // Get all nodes and edges for the graph
      const nodesResult = await nodeRepository.getNodes({ limit: 1000 });
      const edgesResult = await edgeRepository.getEdges({ limit: 1000 });
      
      const graph = dependencyManager.getFullDependencyGraph(
        nodeId,
        nodesResult.data,
        edgesResult.data
      );

      return graph;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch dependency graph', details: error.message });
    }
  });

  // POST /dependencies/validate - Validate edge creation
  fastify.post('/dependencies/validate', async (request, reply) => {
    try {
      const { fromId, toId } = request.body as { fromId: string; toId: string };
      
      const fromNode = await nodeRepository.getNodeById(fromId);
      const toNode = await nodeRepository.getNodeById(toId);
      
      if (!fromNode || !toNode) {
        reply.code(404).send({ error: 'One or both nodes not found' });
        return;
      }

      const isValid = dependencyManager.validateEdgeCreation(fromNode, toNode);
      
      return { valid: isValid };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to validate dependency', details: error.message });
    }
  });

  // GET /dependencies/circular/:nodeId - Check for circular dependencies
  fastify.get('/dependencies/circular/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string };
      
      const edgesResult = await edgeRepository.getEdges({ limit: 1000 });
      const cycles = dependencyManager.findCircularDependencies(edgesResult.data);
      
      return { cycles };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to check circular dependencies', details: error.message });
    }
  });
}