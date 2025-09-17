import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import type { NodeQuery, NodeCreationBody } from '../types'
import { formatStringToNumber } from '../request_parameter'

function nodesRoutes(fastify: FastifyInstance) {
  // GET /nodes - Get nodes with query parameters
  fastify.get('/nodes', async (request, reply) => {
    try {
      const { limit, offset, ...where } = formatStringToNumber(request.query as NodeQuery)
      const result = await repository.getNodes({
        where,
        take: limit,
        skip: offset,
      })
      return {
        data: result.data,
        total: result.total,
        limit,
        offset,
      }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch nodes',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // POST /nodes/batch - Get multiple nodes by IDs
  fastify.post('/nodes/batch', async (request, reply) => {
    try {
      const { ids } = request.body as { ids: string[] }

      if (!ids || !Array.isArray(ids)) {
        reply.code(400).send({ error: 'Invalid request body. Expected { ids: string[] }' })
        return
      }

      const nodes = await repository.getNodesByIds(ids)
      return { data: nodes }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch nodes',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // GET /nodes/:id - Get node by ID
  fastify.get('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const node = await repository.getNodeById(id)

      if (!node) {
        reply.code(404).send({ error: 'Node not found' })
        return
      }

      return node
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch node',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // POST /nodes - Create a new node
  fastify.post('/nodes', async (request, reply) => {
    try {
      const nodeData = request.body as NodeCreationBody
      const node = await repository.createNode(nodeData)
      reply.code(201).send(node)
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to create node',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // PUT /nodes/:id - Update a node
  fastify.put('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const updates = request.body as Partial<NodeCreationBody>

      const updatedNode = await repository.updateNode(id, updates)

      if (!updatedNode) {
        reply.code(404).send({ error: 'Node not found' })
        return
      }

      return updatedNode
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to update node',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // DELETE /nodes/:id - Delete a node
  fastify.delete('/nodes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const success = await repository.deleteNode(id)

      if (!success) {
        reply.code(404).send({ error: 'Node not found' })
        return
      }

      return { success: true, message: 'Node deleted successfully' }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to delete node',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })
}

export default nodesRoutes
