import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import { authenticate, requireAdmin } from '../../auth/middleware'

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/config',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const config = await repository.getLLMConfig()
        if (!config) {
          // Fallback to environment variables if no config in DB
          if (process.env.OPENAI_API_KEY) {
            return {
              id: 'env',
              apiKey: process.env.OPENAI_API_KEY,
              baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
              modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
              temperature: Number(process.env.OPENAI_TEMPERATURE) || 1,
              enabled: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          }

          // Return default/empty config structure if not found
          return {
            apiKey: '',
            baseUrl: '',
            modelName: '',
            temperature: 0,
            enabled: false,
          }
        }
        return config
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to fetch LLM config' })
      }
    },
  )

  fastify.put<{ Body: repository.UpdateLLMConfigData }>(
    '/config',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      try {
        const config = await repository.updateLLMConfig(request.body)
        return config
      } catch (error) {
        request.log.error(error)
        reply.code(500).send({ error: 'Failed to update LLM config' })
      }
    },
  )
}
