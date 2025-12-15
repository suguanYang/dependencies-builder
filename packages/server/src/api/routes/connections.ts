import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import type { ConnectionQuery } from '../types'
import type { Connection, Prisma } from '../../generated/prisma/client'
import { formatStringToNumber } from '../request_parameter'
import { authenticate } from '../../auth/middleware'
import { onlyQuery } from '../../utils'

import { ConnectionWorkerPool } from '../../workers/connection-pool'
import { error as logError } from '../../logging'

function connectionsRoutes(fastify: FastifyInstance) {
  // GET /connections - Get connections with query parameters
  fastify.get('/connections', async (request, reply) => {
    try {
      const { take, skip, fuzzy, ...filters } = formatStringToNumber(
        request.query as ConnectionQuery,
      )
      const isFuzzy = fuzzy === 'true' || fuzzy === true

      // Build the where clause with node field filters
      const where: Prisma.ConnectionFindManyArgs['where'] = onlyQuery(filters, ['fromId', 'toId'])

      // Build AND conditions for node field filters
      const andConditions: Prisma.ConnectionWhereInput[] = []

      // From node filters
      if (filters?.fromNodeName || filters?.fromNodeProjectName || filters.fromNodeType) {
        const fromNodeCondition: Prisma.NodeWhereInput = {}
        if (filters.fromNodeName) {
          fromNodeCondition.name = isFuzzy
            ? { contains: filters.fromNodeName }
            : { equals: filters.fromNodeName }
        }
        if (filters.fromNodeProjectName) {
          fromNodeCondition.projectName = isFuzzy
            ? { contains: filters.fromNodeProjectName }
            : { equals: filters.fromNodeProjectName }
        }
        if (filters.fromNodeType) {
          fromNodeCondition.type = { equals: filters.fromNodeType as any }
        }
        andConditions.push({ fromNode: fromNodeCondition })
      }

      // To node filters
      if (filters.toNodeName || filters.toNodeProjectName || filters.toNodeType) {
        const toNodeCondition: Prisma.NodeWhereInput = {}
        if (filters.toNodeName) {
          toNodeCondition.name = isFuzzy
            ? { contains: filters.toNodeName }
            : { equals: filters.toNodeName }
        }
        if (filters.toNodeProjectName) {
          toNodeCondition.projectName = isFuzzy
            ? { contains: filters.toNodeProjectName }
            : { equals: filters.toNodeProjectName }
        }
        if (filters.toNodeType) {
          toNodeCondition.type = { equals: filters.toNodeType as any }
        }
        andConditions.push({ toNode: toNodeCondition })
      }

      // Add AND conditions if any exist
      if (andConditions.length > 0) {
        where.AND = andConditions
      }

      const result = await repository.getConnections({
        where,
        take,
        skip,
      })
      return {
        data: result.data,
        total: result.total,
        limit: take,
        offset: skip,
      }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /connections - Create a new connection
  fastify.post(
    '/connections',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { fromId, toId } = request.body as Omit<Connection, 'id' | 'createdAt'>
        const connection = await repository.createConnection(fromId, toId)
        reply.code(201).send(connection)
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to create connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )

  // DELETE /connections-by-from/:fromId - Delete connections by from node
  fastify.delete(
    '/connections-by-from/:fromId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { fromId } = request.params as Pick<Connection, 'fromId'>
        const success = await repository.deleteConnectionsByFrom(fromId)

        if (!success) {
          reply.code(404).send({ error: 'No connections found for the specified from node' })
          return
        }

        return { success: true, message: 'Connections deleted successfully' }
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to delete connections',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )

  // DELETE /connections - Delete connection by fromId and toId
  fastify.delete(
    '/connections',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { fromId, toId } = request.query as { fromId: string; toId: string }

        if (!fromId || !toId) {
          reply.code(400).send({ error: 'Missing fromId or toId query parameters' })
          return
        }

        const success = await repository.deleteConnection(fromId, toId)

        if (!success) {
          reply.code(404).send({ error: 'Connection not found' })
          return
        }

        return { success: true, message: 'Connection deleted successfully' }
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to delete connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )

  // POST /connections/all - Trigger connection auto creation manually
  fastify.post('/connections/all', async (request, reply) => {
    try {
      const result = await ConnectionWorkerPool.getPool().executeConnectionAutoCreation()

      // Clear project dependency graph cache
      const { cache } = await import('../../cache/instance')
      await cache.clear('projects/graphs')

      if (!result.success) {
        reply.code(500).send({
          error: 'Connection auto-creation failed',
          details: result.error,
        })
        return
      }

      return result
    } catch (err) {
      reply.code(500).send({
        error: 'Failed to trigger connection auto-creation',
        details: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })
}

export default connectionsRoutes
