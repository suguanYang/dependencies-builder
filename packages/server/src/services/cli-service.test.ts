import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeCLI } from './cli-service'
import * as repository from '../database/repository'
import * as auth from '../auth'
import * as logging from '../logging'
import { spawn } from 'node:child_process'

const { mockSpawn } = vi.hoisted(() => {
  const fn = vi.fn()
  return { mockSpawn: fn }
})

vi.mock('node:child_process', () => {
  return {
    spawn: mockSpawn,
    default: { spawn: mockSpawn },
  }
})

vi.mock('../database/repository')
vi.mock('../auth')
vi.mock('../logging')

describe('CLI Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Default mock implementations
    vi.mocked(repository.updateAction).mockResolvedValue({} as any)
    vi.mocked(auth.getAdminUserKey).mockResolvedValue({ key: 'test-key', id: 'key-id' } as any)
    vi.mocked(auth.revokeAdminKey).mockResolvedValue({} as any)

    // Setup mock return value
    mockSpawn.mockImplementation((...args) => {
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
        unref: vi.fn(),
        ref: vi.fn(),
      } as any
    })
  })

  it('should inject LLM config from database into CLI environment', async () => {
    // Mock DB config present
    vi.mocked(repository.getLLMConfig).mockResolvedValue({
      id: '1',
      apiKey: 'db-key',
      baseUrl: 'https://db-url.com',
      modelName: 'db-model',
      temperature: 0.9,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const actionData = {
      type: 'static_analysis',
      projectAddr: 'test-addr',
      branch: 'main',
      projectName: 'test-project',
    } as any

    await executeCLI('action-1', actionData)

    expect(mockSpawn).toHaveBeenCalled()
    const callArgs = mockSpawn.mock.calls[0]
    const options = callArgs[2]

    expect(options.env).toBeDefined()
    expect(options.env.OPENAI_API_KEY).toBe('db-key')
    expect(options.env.OPENAI_BASE_URL).toBe('https://db-url.com')
    expect(options.env.OPENAI_MODEL_NAME).toBe('db-model')
    expect(options.env.OPENAI_TEMPERATURE).toBe('0.9')
    expect(options.env.DMS_SERVER_CLI_KEY).toBe('test-key')
  })

  it('should not inject LLM config when DB config is missing (fallback to process.env)', async () => {
    // Mock DB config missing
    vi.mocked(repository.getLLMConfig).mockResolvedValue(null)

    const originalEnv = process.env
    process.env = { ...originalEnv, OPENAI_API_KEY: 'env-key-fallback' }

    try {
      const actionData = {
        type: 'static_analysis',
        projectAddr: 'test-addr',
        branch: 'main',
        projectName: 'test-project',
      } as any

      await executeCLI('action-2', actionData)

      expect(mockSpawn).toHaveBeenCalled()
      const callArgs = mockSpawn.mock.calls[0]
      const options = callArgs[2]

      expect(options.env).toBeDefined()
      expect(options.env.OPENAI_API_KEY).toBe('env-key-fallback')

      expect(logging.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'No LLM configuration found in database (or disabled). Using environment variables.',
        ),
      )
    } finally {
      process.env = originalEnv
    }
  })

  it('should not inject LLM config when DB config is disabled', async () => {
    // Mock DB config disabled
    vi.mocked(repository.getLLMConfig).mockResolvedValue({
      id: '1',
      apiKey: 'db-key',
      baseUrl: 'https://db-url.com',
      modelName: 'db-model',
      temperature: 0.9,
      enabled: false,
    } as any)

    const originalEnv = process.env
    process.env = { ...originalEnv, OPENAI_API_KEY: 'env-key-fallback' }

    try {
      const actionData = {
        type: 'static_analysis',
        projectAddr: 'test-addr',
        branch: 'main',
        projectName: 'test-project',
      } as any

      await executeCLI('action-3', actionData)

      expect(mockSpawn).toHaveBeenCalled()
      const callArgs = mockSpawn.mock.calls[0]
      const options = callArgs[2]

      expect(options.env).toBeDefined()
      expect(options.env.OPENAI_API_KEY).toBe('env-key-fallback')

      expect(logging.info).toHaveBeenCalledWith(
        expect.stringContaining('No LLM configuration found in database (or disabled)'),
      )
    } finally {
      process.env = originalEnv
    }
  })
})
