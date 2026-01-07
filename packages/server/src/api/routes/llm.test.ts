import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('LLM Configuration API', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await prisma.lLMConfig.deleteMany()
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    // Reset env vars before each test
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_MODEL_NAME
    delete process.env.OPENAI_TEMPERATURE
  })

  afterEach(async () => {
    await prisma.lLMConfig.deleteMany()
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    // Clean up env vars
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_MODEL_NAME
    delete process.env.OPENAI_TEMPERATURE
  })

  it('should return env var config when DB is empty', async () => {
    // Set environment variables
    process.env.OPENAI_API_KEY = 'env-api-key'
    process.env.OPENAI_BASE_URL = 'https://env-api.com'
    process.env.OPENAI_MODEL_NAME = 'env-gpt-4'
    process.env.OPENAI_TEMPERATURE = '0.5'
    process.env.LLM_MODEL_MAX_TOKENS = '200000'
    process.env.LLM_REQUESTS_PER_MINUTE = '120'

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'GET',
      url: '/llm/config',
      headers,
    })

    expect(response.statusCode).toBe(200)
    const config = response.json()
    expect(config.id).toBe('env')
    expect(config.apiKey).toBe('env-api-key')
    expect(config.baseUrl).toBe('https://env-api.com')
    expect(config.modelName).toBe('env-gpt-4')
    expect(config.temperature).toBe(0.5)
    expect(config.enabled).toBe(true)
    expect(config.modelMaxTokens).toBe(200000)
    expect(config.requestsPerMinute).toBe(120)
  })

  it('should return DB config when present, ignoring env vars', async () => {
    // Set environment variables (should be ignored)
    process.env.OPENAI_API_KEY = 'env-api-key'

    // Create DB config
    await prisma.lLMConfig.create({
      data: {
        apiKey: 'db-api-key',
        baseUrl: 'https://db-api.com',
        modelName: 'db-gpt-4',
        temperature: 0.8,
        enabled: false,
        modelMaxTokens: 32000,
        safeBuffer: 2000,
        systemPromptCost: 1000,
        windowSize: 50,
        requestsPerMinute: 30,
      },
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'GET',
      url: '/llm/config',
      headers,
    })

    expect(response.statusCode).toBe(200)
    const config = response.json()
    expect(config.id).not.toBe('env')
    expect(config.apiKey).toBe('db-api-key')
    expect(config.baseUrl).toBe('https://db-api.com')
    expect(config.enabled).toBe(false)
  })

  it('should return empty default config when both DB and env vars are missing', async () => {
    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'GET',
      url: '/llm/config',
      headers,
    })

    expect(response.statusCode).toBe(200)
    const config = response.json()
    expect(config.apiKey).toBe('')
    expect(config.enabled).toBe(false)
  })

  it('should update configuration in DB', async () => {
    const { headers } = await getAuthHeaders(server, 'admin')

    const updateData = {
      apiKey: 'new-api-key',
      baseUrl: 'https://new-api.com',
      modelName: 'gpt-4-turbo',
      temperature: 0.7,
      enabled: true,
      modelMaxTokens: 128000,
      safeBuffer: 4000,
      systemPromptCost: 2000,
      windowSize: 100,
      requestsPerMinute: 60,
    }

    const response = await server.inject({
      method: 'PUT',
      url: '/llm/config',
      headers,
      payload: updateData,
    })

    expect(response.statusCode).toBe(200)
    const config = response.json()
    expect(config.apiKey).toBe('new-api-key')
    expect(config.modelMaxTokens).toBe(128000)
    expect(config.requestsPerMinute).toBe(60)

    // Verify persistence
    const savedConfig = await prisma.lLMConfig.findFirst()
    expect(savedConfig).toBeTruthy()
    expect(savedConfig?.apiKey).toBe('new-api-key')
    expect(savedConfig?.modelMaxTokens).toBe(128000)
    expect(savedConfig?.requestsPerMinute).toBe(60)
  })

  it('should deny access to non-admin users', async () => {
    const { headers } = await getAuthHeaders(server, 'user')

    const response = await server.inject({
      method: 'GET',
      url: '/llm/config',
      headers,
    })

    expect(response.statusCode).toBe(403)
  })
})
