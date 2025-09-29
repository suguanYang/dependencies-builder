import { FastifyInstance } from 'fastify'
import * as repository from '../../database/actions-repository'
import { formatStringToNumber } from '../request_parameter'
import { executeCLI, getActiveExecution } from '../../services/cli-service'
import { error, info } from '../../logging'
import { PassThrough, pipeline } from 'node:stream'

function actionsRoutes(fastify: FastifyInstance) {
  // GET /actions - Get actions with query parameters
  fastify.get('/actions', async (request, reply) => {
    try {
      const query = formatStringToNumber(request.query as repository.ActionQuery)
      const result = await repository.getActions(query)
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
          error: 'Failed to fetch actions',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // GET /actions/:id - Get action by ID
  fastify.get('/actions/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const action = await repository.getActionById(id)

      if (!action) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      return action
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch action',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // POST /actions - Create a new action and trigger CLI execution
  fastify.post('/actions', async (request, reply) => {
    try {
      const actionData = request.body as repository.CreateActionData

      // Debug: Log the received action data
      info(`Received action data for creation: ${JSON.stringify(actionData)}`)

      // Create the action record
      const action = await repository.createAction(actionData)

      // Trigger CLI execution asynchronously
      executeCLI(action.id, actionData).catch((error) => {
        repository.updateAction(action.id, { status: 'failed' })
        error('Failed to execute action' + error)
      })

      reply.code(201).send(action)
    } catch (err) {
      error('Failed to create action' + err)
      reply
        .code(500)
        .send({
          error: 'Failed to create action',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
    }
  })

  // DELETE /actions/:id - Delete an action
  fastify.delete('/actions/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const success = await repository.deleteAction(id)
      const activeExecution = getActiveExecution(id)
      if (activeExecution) {
        activeExecution.stop()
      }

      if (!success) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      return reply.code(200).send({ success: true, message: 'Action deleted successfully' })
    } catch (err) {
      error(err)
      reply
        .code(500)
        .send({
          error: 'Failed to delete action',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
    }
  })

  // GET /actions/:id/result - Get action result
  fastify.get('/actions/:id/result', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const action = await repository.getActionById(id)

      if (!action) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      return { result: action.result }
    } catch (error) {
      reply
        .code(500)
        .send({
          error: 'Failed to fetch action result',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
    }
  })

  // GET /actions/:id/stream - Stream action logs
  fastify.get('/actions/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Check if action exists
    const action = await repository.getActionById(id)
    if (!action) {
      reply.code(404).send({ error: 'Action not found' })
      return
    }

    // Check if action is still running
    const activeExecution = getActiveExecution(id)
    if (!activeExecution && action.status === 'running') {
      reply.code(404).send({ error: 'Action execution not found' })
      return
    }

    // If action is completed or failed, send final status
    if (action.status !== 'running') {
      reply.send(`[info] action is already completed` + '\n')
      return
    }

    // Stream from active execution
    if (activeExecution) {
      reply.send(activeExecution.stream)
    }
  })

  // POST /actions/:id/stop - Stop action execution
  fastify.post('/actions/:id/stop', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const activeExecution = getActiveExecution(id)

      if (activeExecution) {
        activeExecution.stop()
        return { success: true, message: 'Action execution stopped' }
      } else {
        reply.code(404).send({ error: 'Action not found or not running' })
      }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to stop action execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}

export default actionsRoutes