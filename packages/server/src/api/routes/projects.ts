import { FastifyInstance } from 'fastify'

import { queryContains } from '../../utils'
import * as repository from '../../database/repository'
import type { ProjectQuery, ProjectCreationBody, ProjectUpdateBody } from '../types'
import { formatStringToNumber } from '../request_parameter'
import { authenticate, requireAdmin } from '../../auth/middleware'

function projectsRoutes(fastify: FastifyInstance) {
  // GET /projects - Get projects with query parameters
  fastify.get('/projects', async (request, reply) => {
    try {
      const { limit, offset, ...where } = formatStringToNumber(request.query as ProjectQuery)
      queryContains(where, ['name', 'addr'])
      const result = await repository.getProjects({
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
      reply.code(500).send({
        error: 'Failed to fetch projects',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /projects/:id - Get project by ID
  fastify.get('/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const project = await repository.getProjectById(id)

      if (!project) {
        reply.code(404).send({ error: 'Project not found' })
        return
      }

      return project
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch project',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /projects/name/:name - Get project by name
  fastify.get('/projects/name/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string }
      const project = await repository.getProjectByName(name)

      if (!project) {
        reply.code(404).send({ error: 'Project not found' })
        return
      }

      return project
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch project',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /projects - Create a new project
  fastify.post(
    '/projects',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const projectData = request.body as ProjectCreationBody
        const project = await repository.createProject(projectData)
        reply.code(201).send(project)
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          reply.code(409).send({ error: error.message })
        } else {
          reply.code(500).send({
            error: 'Failed to create project',
            details: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    },
  )

  // PUT /projects/:id - Update a project
  fastify.put(
    '/projects/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const updates = request.body as ProjectUpdateBody

        const updatedProject = await repository.updateProject(id, updates)

        if (!updatedProject) {
          reply.code(404).send({ error: 'Project not found' })
          return
        }

        return updatedProject
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          reply.code(409).send({ error: error.message })
        } else {
          reply.code(500).send({
            error: 'Failed to update project',
            details: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    },
  )

  // DELETE /projects/:id - Delete a project
  fastify.delete(
    '/projects/:id',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const success = await repository.deleteProject(id)

        if (!success) {
          reply.code(404).send({ error: 'Project not found' })
          return
        }

        return { success: true, message: 'Project deleted successfully' }
      } catch (error) {
        reply.code(500).send({
          error: 'Failed to delete project',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )
}

export default projectsRoutes
