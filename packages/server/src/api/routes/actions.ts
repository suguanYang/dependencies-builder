import { FastifyInstance } from 'fastify'
import * as repository from '../../database/actions-repository'
import { formatStringToNumber } from '../request_parameter'
import { ActionData, executeCLI, getActiveExecution } from '../../services/cli-service'
import { error as logError, info } from '../../logging'
import { connectionWorkerPool } from '../../workers/worker-pool'
import { authenticate, requireAdmin } from '../../auth/middleware'

function actionsRoutes(fastify: FastifyInstance) {
  // GET /actions - Get actions with query parameters
  fastify.get('/actions', {
    preHandler: [authenticate]
  }, async (request, reply) => {
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
      reply.code(500).send({
        error: 'Failed to fetch actions',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /actions/:id - Get action by ID
  fastify.get('/actions/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const action = await repository.getActionById(id)

      if (!action) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      return action
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch action',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /actions - Create a new action and trigger CLI execution
  fastify.post('/actions', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      const actionData = request.body as ActionData

      // Check if there are too many running actions (limit: 10)
      const runningActionsCount = await repository.countRunningActions()
      if (runningActionsCount >= 10) {
        reply.code(429).send({
          error: 'Too many running actions',
          details: `Currently ${runningActionsCount} actions are running. Maximum allowed is 10.`,
        })
        return
      }

      // Create the action record
      const action = await repository.createAction(actionData)

      if (actionData.type === 'connection_auto_create') {
        connectionWorkerPool.executeConnectionAutoCreation(action.id)
      } else if (actionData.type === 'static_analysis' || actionData.type === 'report') {
        executeCLI(action.id, actionData).catch((error) => {
          repository.updateAction(action.id, { status: 'failed' })
          error('Failed to execute action' + error)
        })
      }

      reply.code(201).send(action)
    } catch (err) {
      logError('Failed to create action' + err)
      reply.code(500).send({
        error: 'Failed to create action',
        details: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  // DELETE /actions/:id - Delete an action
  fastify.delete('/actions/:id', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const success = await repository.deleteAction(id)
      const activeExecution = getActiveExecution(id)
      if (activeExecution) {
        await activeExecution.stop()
      }

      if (!success) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      return reply.code(200).send({ success: true, message: 'Action deleted successfully' })
    } catch (err) {
      logError(err)
      reply.code(500).send({
        error: 'Failed to delete action',
        details: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  // POST /actions/:id/stop - Stop action execution
  fastify.post('/actions/:id/stop', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const action = await repository.getActionById(id)
      if (!action) {
        reply.code(404).send({ error: 'Action not found' })
        return
      }

      if (action.type === 'connection_auto_create') {
        const success = connectionWorkerPool.stopExecution(id)
        if (!success) {
          reply.code(404).send({ error: 'Connection auto-creation not found' })
          return
        }
        return { success: true, message: 'Connection auto-creation stopped' }
      }

      const activeExecution = getActiveExecution(id)

      if (activeExecution) {
        await activeExecution.stop()
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

  // POST /actions/connection-auto-create - Trigger connection auto-creation
  fastify.post('/actions/connection-auto-create', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      // Check if there are too many running actions (limit: 10)
      const runningActionsCount = await repository.countRunningActions()
      if (runningActionsCount >= 10) {
        reply.code(429).send({
          error: 'Too many running actions',
          details: `Currently ${runningActionsCount} actions are running. Maximum allowed is 10.`,
        })
        return
      }

      // Create the action record
      const action = await repository.createAction({
        type: 'connection_auto_create',
      })

      // Trigger connection auto-creation in worker thread
      const result = await connectionWorkerPool.executeConnectionAutoCreation(action.id)
      if (!result.success) {
        repository.updateAction(action.id, {
          status: 'failed',
          error: result.error,
        })

        reply.code(500).send({
          error: 'Failed to trigger connection auto-creation',
          details: result.error,
        })
        return
      }

      reply.code(201).send(action)
    } catch (error) {
      logError('Failed to trigger connection auto-creation: ' + error)
      reply.code(500).send({
        error: 'Failed to trigger connection auto-creation',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}

export default actionsRoutes
