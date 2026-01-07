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
              // Token Budget Configuration
              modelMaxTokens: parseInt(process.env.LLM_MODEL_MAX_TOKENS || '128000', 10),
              safeBuffer: parseInt(process.env.LLM_SAFE_BUFFER || '4000', 10),
              systemPromptCost: parseInt(process.env.LLM_SYSTEM_PROMPT_COST || '2000', 10),
              windowSize: parseInt(process.env.LLM_WINDOW_SIZE || '100', 10),
              // Rate Limiting Configuration
              requestsPerMinute: parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10),
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
            modelMaxTokens: 128000,
            safeBuffer: 4000,
            systemPromptCost: 2000,
            windowSize: 100,
            requestsPerMinute: 60,
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
