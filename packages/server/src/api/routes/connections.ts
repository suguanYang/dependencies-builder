import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import type { ConnectionQuery } from '../types'
import type { Connection, Node } from '../../generated/prisma'
import { formatStringToNumber } from '../request_parameter'
import { autoCreateConnections } from '../../dependency/connections'
import { error } from '../../logging'

function connectionsRoutes(fastify: FastifyInstance) {
  // GET /connections - Get connections with query parameters
  fastify.get('/connections', async (request, reply) => {
    try {
      const query = formatStringToNumber(request.query as ConnectionQuery)
      const result = await repository.getConnections(query)
      return {
        data: result.data,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch connections',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // POST /connections - Create a new connection
  fastify.post('/connections', async (request, reply) => {
    try {
      const { fromId, toId } = request.body as Omit<Connection, 'id' | 'createdAt'>
      const connection = await repository.createConnection(fromId, toId)
      reply.code(201).send(connection)
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to create connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // DELETE /connections-by-from/:fromId - Delete connections by from node
  fastify.delete('/connections-by-from/:fromId', async (request, reply) => {
    try {
      const { fromId } = request.params as Pick<Connection, 'fromId'>
      const success = await repository.deleteConnectionsByFrom(fromId)

      if (!success) {
        reply.code(404).send({ error: 'No connections found for the specified from node' })
        return
      }

      return { success: true, message: 'Connections deleted successfully' }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to delete connections',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // POST /connections/auto-create - Automatically create connections between nodes
  fastify.post('/connections/auto-create', async (request, reply) => {
    try {
      const result = await autoCreateConnections()

      return {
        success: true,
        message: 'Connections created successfully',
        createdConnections: result.createdConnections,
        skippedConnections: result.skippedConnections,
        errors: result.errors
      }
    } catch (err) {
      error('Failed to auto-create connections: %o' + err)
      reply
        .code(500)
        .send({
          error: 'Failed to auto-create connections',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
    }
  })

  // DELETE /connections/:id - Delete connections by id
  fastify.delete('/connections/:id', async (request, reply) => {
    try {
      const { id } = request.params as Pick<Connection, 'id'>
      const success = await repository.deleteConnection(id)

      if (!success) {
        reply.code(404).send({ error: 'No connections found for the specified id' })
        return
      }

      return { success: true, message: 'Connection deleted successfully' }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to delete connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })
}

export default connectionsRoutes
