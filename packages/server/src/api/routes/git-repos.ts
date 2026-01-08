import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import { authenticate, requireAdmin } from '../../auth/middleware'

export default async function (fastify: FastifyInstance) {
  // GET /git-repos - List all git repo configurations (admin only)
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const result = await repository.getGitRepos()
        return result
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to fetch git repos' })
      }
    },
  )

  // GET /git-repos/:id - Get a specific git repo (admin only)
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const gitRepo = await repository.getGitRepoById(request.params.id)
        if (!gitRepo) {
          return reply.code(404).send({ error: 'Git repo not found' })
        }
        return gitRepo
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to fetch git repo' })
      }
    },
  )

  // GET /git-repos/by-host - Get git repo by host (CLI authenticated)
  fastify.get<{ Querystring: { host: string } }>(
    '/by-host',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { host } = request.query

        if (!host) {
          return reply.code(400).send({ error: 'host query parameter is required' })
        }

        const gitRepo = await repository.getGitRepoByHost(host)
        if (!gitRepo) {
          return reply.code(404).send({ error: 'Git repo not found' })
        }

        return gitRepo
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to fetch git repo' })
      }
    },
  )

  // POST /git-repos - Create a new git repo (admin only)
  fastify.post<{ Body: repository.CreateGitRepoData }>(
    '/',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const gitRepo = await repository.createGitRepo(request.body)
        return gitRepo
      } catch (error) {
        request.log.error(error)
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.code(409).send({ error: error.message })
        }
        reply.code(500).send({ error: 'Failed to create git repo' })
      }
    },
  )

  // PUT /git-repos/:id - Update git repo (admin only)
  fastify.put<{ Params: { id: string }; Body: repository.UpdateGitRepoData }>(
    '/:id',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const gitRepo = await repository.updateGitRepo(request.params.id, request.body)
        return gitRepo
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to update git repo' })
      }
    },
  )

  // DELETE /git-repos/:id - Delete git repo (admin only)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const success = await repository.deleteGitRepo(request.params.id)
        if (!success) {
          return reply.code(404).send({ error: 'Git repo not found' })
        }
        return { success: true }
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to delete git repo' })
      }
    },
  )
}
