import { FastifyInstance } from 'fastify'
import * as repository from '../../database/repository'
import { authenticate, requireAdmin } from '../../auth/middleware'
import { concurrentLimiter } from '../../llm/concurrent-limiter'

interface RateLimitAcquireBody {
  clientId?: string
}

interface RateLimitReleaseBody {
  leaseId: string
}

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

  fastify.post(
    '/rate-limit/acquire',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        // Get LLM config to determine configKey and limit
        const config = await repository.getLLMConfig()
        let configKey = 'env'
        let limit = parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10)
        if (config) {
          configKey = config.id
          limit = config.requestsPerMinute
        }
        const clientId = (request.body as RateLimitAcquireBody)?.clientId

        request.log.info('Concurrent rate limit acquisition attempt', {
          configKey,
          limit,
          clientId: clientId || 'anonymous',
        } as any)

        // Try to acquire a lease
        const lease = concurrentLimiter.acquire(configKey, clientId, limit)

        if (lease) {
          request.log.debug('Concurrent rate limit lease granted', {
            configKey,
            clientId: clientId || 'anonymous',
            leaseId: lease.id,
            activeCount: concurrentLimiter.getActiveCount(configKey),
          } as any)
          return { allowed: true, leaseId: lease.id }
        } else {
          // No available slots - client should retry after a short delay
          const waitTimeMs = 10000 // 10 second retry delay
          request.log.debug('Concurrent rate limit denied - no available slots', {
            configKey,
            clientId: clientId || 'anonymous',
            waitTimeMs,
            activeCount: concurrentLimiter.getActiveCount(configKey),
          } as any)
          return { allowed: false, waitTimeMs }
        }
      } catch (error) {
        request.log.error('Concurrent rate limit acquisition failed', error as any)
        reply.code(500).send({ error: 'Failed to acquire concurrent rate limit lease' })
      }
    },
  )

  fastify.put(
    '/rate-limit/release',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { leaseId } = request.body as RateLimitReleaseBody
        if (!leaseId) {
          reply.code(400).send({ error: 'leaseId is required' })
          return
        }

        const released = concurrentLimiter.release(leaseId)
        if (released) {
          request.log.debug('Concurrent rate limit lease released', { leaseId } as any)
          return { released: true }
        } else {
          request.log.debug('Concurrent rate limit lease not found or already released', {
            leaseId,
          } as any)
          // Still return success - idempotent operation
          return { released: false, message: 'Lease not found or already released' }
        }
      } catch (error) {
        request.log.error('Concurrent rate limit release failed', error as any)
        reply.code(500).send({ error: 'Failed to release concurrent rate limit lease' })
      }
    },
  )
}
