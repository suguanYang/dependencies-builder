import { FastifyInstance } from 'fastify';
import { EdgeRepository } from '../../database/repository';
import { EdgeQuery } from '../../dependency/types';

export function edgesRoutes(fastify: FastifyInstance, edgeRepository: EdgeRepository) {
  // GET /edges - Get edges with query parameters
  fastify.get('/edges', async (request, reply) => {
    try {
      const query = request.query as EdgeQuery;
      const result = await edgeRepository.getEdges(query);
      return result;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch edges', details: error.message });
    }
  });

  // GET /edges/:id - Get edge by ID
  fastify.get('/edges/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const edges = await edgeRepository.getEdges({});
      const edge = edges.data.find(e => e.id === id);
      
      if (!edge) {
        reply.code(404).send({ error: 'Edge not found' });
        return;
      }

      return edge;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch edge', details: error.message });
    }
  });

  // POST /edges - Create a new edge
  fastify.post('/edges', async (request, reply) => {
    try {
      const { fromId, toId } = request.body as { fromId: string; toId: string };
      const edge = await edgeRepository.createEdge(fromId, toId);
      reply.code(201).send(edge);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create edge', details: error.message });
    }
  });

  // DELETE /edges/:id - Delete an edge
  fastify.delete('/edges/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const success = await edgeRepository.deleteEdge(id);
      
      if (!success) {
        reply.code(404).send({ error: 'Edge not found' });
        return;
      }

      return { success: true, message: 'Edge deleted successfully' };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete edge', details: error.message });
    }
  });

  // DELETE /edges-by-from/:fromId - Delete edges by from node
  fastify.delete('/edges-by-from/:fromId', async (request, reply) => {
    try {
      const { fromId } = request.params as { fromId: string };
      const success = await edgeRepository.deleteEdgesByFrom(fromId);
      
      if (!success) {
        reply.code(404).send({ error: 'No edges found for the specified from node' });
        return;
      }

      return { success: true, message: 'Edges deleted successfully' };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete edges', details: error.message });
    }
  });
}