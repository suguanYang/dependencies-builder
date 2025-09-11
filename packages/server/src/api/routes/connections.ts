import { FastifyInstance } from 'fastify';
import * as repository from '../../database/repository';
import type { ConnectionQuery } from '../types';
import type { Connection } from '../../generated/prisma';

function connectionsRoutes(fastify: FastifyInstance) {
  // GET /connections - Get connections with query parameters
  fastify.get('/connections', async (request, reply) => {
    try {
      const { limit = 100, offset = 0, ...where } = request.query as ConnectionQuery;
      const query = {
        where,
        take: limit,
        skip: offset,
      };
      const result = await repository.getConnections(query);
      return {
        data: result.data,
        total: result.total,
        limit,
        offset,
      };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch connections', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /connections - Create a new connection
  fastify.post('/connections', async (request, reply) => {
    try {
      const { fromId, toId } = request.body as Omit<Connection, 'id' | 'createdAt'>;
      const connection = await repository.createConnection(fromId, toId);
      reply.code(201).send(connection);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create connection', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // DELETE /connections-by-from/:fromId - Delete connections by from node
  fastify.delete('/connections-by-from/:fromId', async (request, reply) => {
    try {
      const { fromId } = request.params as Pick<Connection, 'fromId'>;
      const success = await repository.deleteConnectionsByFrom(fromId);

      if (!success) {
        reply.code(404).send({ error: 'No connections found for the specified from node' });
        return;
      }

      return { success: true, message: 'Connections deleted successfully' };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete connections', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}

export default connectionsRoutes;