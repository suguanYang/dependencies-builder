import { FastifyInstance } from 'fastify';
import { NodeRepository } from '../../database/repository';
import { NodeQuery } from '../../dependency/types';

export function nodesRoutes(fastify: FastifyInstance, nodeRepository: NodeRepository) {
  // GET /nodes - Get nodes with query parameters
  fastify.get('/nodes', async (request, reply) => {
    try {
      const query = request.query as NodeQuery;
      const result = await nodeRepository.getNodes(query);
      return result;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch nodes', details: error.message });
    }
  });

  // GET /nodes/:id - Get node by ID
  fastify.get('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const node = await nodeRepository.getNodeById(id);
      
      if (!node) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }

      return node;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch node', details: error.message });
    }
  });

  // POST /nodes - Create a new node
  fastify.post('/nodes', async (request, reply) => {
    try {
      const nodeData = request.body as Omit<Node, 'id' | 'createdAt' | 'updatedAt'>;
      const node = await nodeRepository.createNode(nodeData);
      reply.code(201).send(node);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create node', details: error.message });
    }
  });

  // PUT /nodes/:id - Update a node
  fastify.put('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = request.body as Partial<Node>;
      
      const updatedNode = await nodeRepository.updateNode(id, updates);
      
      if (!updatedNode) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }

      return updatedNode;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update node', details: error.message });
    }
  });

  // DELETE /nodes/:id - Delete a node
  fastify.delete('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const success = await nodeRepository.deleteNode(id);
      
      if (!success) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }

      return { success: true, message: 'Node deleted successfully' };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete node', details: error.message });
    }
  });
}