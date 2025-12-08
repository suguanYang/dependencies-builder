import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import { formatStringToNumber } from '../request_parameter'
import { ActionData, executeCLI, getActiveExecution } from '../../services/cli-service'
import { error as logError } from '../../logging'
import { ConnectionWorkerPool } from '../../workers/worker-pool'
import { authenticate } from '../../auth/middleware'
import { ActionQuery } from '../types'
import { onlyQuery } from '../../utils'

function actionsRoutes(fastify: FastifyInstance) {
  // GET /actions - Get actions with query parameters
  fastify.get('/actions', async (request, reply) => {
    try {
      const { take, skip, ...filters } = formatStringToNumber(request.query as ActionQuery)

      const where = onlyQuery(filters, ['status', 'type'])

      const result = await repository.getActions({
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
      reply.code(500).send({
        error: 'Failed to fetch action',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /actions - Create a new action and trigger CLI execution
  fastify.post(
    '/actions',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
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

        // Check if there is already an active connection_auto_create action
        if (actionData.type === 'connection_auto_create') {
          const { ConnectionScheduler } = await import('../../services/scheduler')
          const action = await ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(true)
          reply.code(200).send(action)
          return
        }

        // Create the action record
        const action = await repository.createAction(actionData)

        if (actionData.type === 'static_analysis' || actionData.type === 'report') {
          executeCLI(action.id, actionData).catch((error) => {
            repository.updateAction(action.id, { status: 'failed' })
            logError('Failed to execute action' + error)
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
    },
  )

  // PUT /nodes/:id - Update a node
  fastify.put(
    '/actions/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const actionData = request.body as repository.UpdateActionData

        const action = await repository.getActionById(id)

        if (!action) {
          reply.code(404).send({ error: 'Action not found' })
          return
        }

        const updatedAction = await repository.updateAction(id, actionData)

        if (!updatedAction) {
          reply.code(404).send({ error: 'Action not found' })
          return
        }

        return updatedAction
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to update action',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )

  // DELETE /actions/:id - Delete an action
  fastify.delete(
    '/actions/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
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
    },
  )

  // POST /actions/:id/stop - Stop action execution
  fastify.post(
    '/actions/:id/stop',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }

        const action = await repository.getActionById(id)
        if (!action) {
          reply.code(404).send({ error: 'Action not found' })
          return
        }

        if (action.type === 'connection_auto_create') {
          const success = ConnectionWorkerPool.getPool().stopExecution(id)
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
    },
  )
}

export default actionsRoutes
