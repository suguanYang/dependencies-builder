import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('../api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-client-id'),
}))

describe('Rate Limiter', () => {
  let apiRequest: any
  let randomUUID: any
  let waitForRateLimit: any
  let resetRateLimiter: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()

    // Import mocked dependencies
    const apiModule = await import('../api')
    apiRequest = apiModule.apiRequest

    const cryptoModule = await import('node:crypto')
    randomUUID = cryptoModule.randomUUID

    // Import the module under test
    const rateLimiterModule = await import('./rate-limiter')
    waitForRateLimit = rateLimiterModule.waitForRateLimit
    resetRateLimiter = rateLimiterModule.resetRateLimiter
    // Reset rate limiter state for test isolation
    resetRateLimiter()

    // Reset environment variables
    delete process.env.LLM_REQUESTS_PER_MINUTE
    delete process.env.LLM_USE_SERVER_RATE_LIMIT
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Server-side rate limiting', () => {
    it('should acquire token from server when allowed', async () => {
      // Mock successful server response with leaseId
      apiRequest
        .mockResolvedValueOnce({ allowed: true, leaseId: 'test-lease-id' })
        .mockResolvedValueOnce({ released: true })

      await waitForRateLimit()

      expect(apiRequest).toHaveBeenCalledTimes(2)
      expect(apiRequest).toHaveBeenNthCalledWith(1, 'llm/rate-limit/acquire', {
        method: 'POST',
        body: JSON.stringify({ clientId: 'test-client-id' }),
      })
      expect(apiRequest).toHaveBeenNthCalledWith(2, 'llm/rate-limit/release', {
        method: 'PUT',
        body: JSON.stringify({ leaseId: 'test-lease-id' }),
      })
    })

    it('should wait and retry when server denies with wait time', async () => {
      // Mock server denial with wait time, then success with leaseId, then release
      apiRequest
        .mockResolvedValueOnce({ allowed: false, waitTimeMs: 100 })
        .mockResolvedValueOnce({ allowed: true, leaseId: 'test-lease-id' })
        .mockResolvedValueOnce({ released: true })

      const startTime = Date.now()
      await waitForRateLimit()
      const endTime = Date.now()

      // Should have waited at least 100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(100)

      // Should have called three times (denied, acquire, release)
      expect(apiRequest).toHaveBeenCalledTimes(3)
    })

    it('should throw error when server request fails', async () => {
      // Mock server error
      apiRequest.mockRejectedValue(new Error('Network error'))

      // Should throw error
      await expect(waitForRateLimit()).rejects.toThrow(
        'Rate limiting coordination failed: Network error',
      )

      // Should have tried server once
      expect(apiRequest).toHaveBeenCalledTimes(1)
    })

    it.skip('should throw error when server returns no wait time', async () => {
      // Mock server denial without wait time
      apiRequest.mockResolvedValue({ allowed: false })

      // Should throw error
      await expect(waitForRateLimit()).rejects.toThrow('Server rate limit denied without wait time')

      // Should have tried server once
      expect(apiRequest).toHaveBeenCalledTimes(1)
    })

    it('should respect LLM_USE_SERVER_RATE_LIMIT=false environment variable', async () => {
      process.env.LLM_USE_SERVER_RATE_LIMIT = 'false'

      await waitForRateLimit()

      // Should not call server
      expect(apiRequest).not.toHaveBeenCalled()
    })
  })

  describe('Local rate limiting (when server-side disabled)', () => {
    beforeEach(() => {
      // Disable server-side rate limiting
      process.env.LLM_USE_SERVER_RATE_LIMIT = 'false'
      // Server should not be called, but mock just in case
      apiRequest.mockRejectedValue(new Error('Should not be called'))
    })

    it('should space requests according to rate limit', async () => {
      process.env.LLM_REQUESTS_PER_MINUTE = '60' // 1 request per second

      const startTime = Date.now()

      // Make two requests
      await waitForRateLimit()
      await waitForRateLimit()

      const endTime = Date.now()
      const elapsed = endTime - startTime

      // Should have waited ~1000ms between requests
      expect(elapsed).toBeGreaterThanOrEqual(900) // Allow some tolerance
      expect(elapsed).toBeLessThan(1100)
    })

    it('should handle different rate limits', async () => {
      process.env.LLM_REQUESTS_PER_MINUTE = '120' // 1 request per 500ms

      const startTime = Date.now()
      await waitForRateLimit()
      await waitForRateLimit()
      const endTime = Date.now()

      const elapsed = endTime - startTime
      expect(elapsed).toBeGreaterThanOrEqual(450) // ~500ms
      expect(elapsed).toBeLessThan(600)
    })

    it('should use default rate limit when env var not set', async () => {
      // LLM_REQUESTS_PER_MINUTE not set, default is 60

      const startTime = Date.now()
      await waitForRateLimit()
      await waitForRateLimit()
      const endTime = Date.now()

      const elapsed = endTime - startTime
      expect(elapsed).toBeGreaterThanOrEqual(900) // ~1000ms
      expect(elapsed).toBeLessThan(1100)
    })

    it('should reset rate limiter state', async () => {
      process.env.LLM_REQUESTS_PER_MINUTE = '60'

      // First request
      await waitForRateLimit()

      // Reset
      resetRateLimiter()

      // Second request immediately after reset should not wait
      const startTime = Date.now()
      await waitForRateLimit()
      const endTime = Date.now()

      // Should not have waited (reset cleared the nextAvailableTime)
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('Concurrent requests', () => {
    it('should handle multiple concurrent requests with local rate limiting', async () => {
      process.env.LLM_REQUESTS_PER_MINUTE = '60'
      process.env.LLM_USE_SERVER_RATE_LIMIT = 'false'

      const startTime = Date.now()

      // Fire 3 requests concurrently
      const promises = [waitForRateLimit(), waitForRateLimit(), waitForRateLimit()]

      await Promise.all(promises)
      const endTime = Date.now()

      // With rate limit of 60 RPM (1000ms between requests),
      // 3 concurrent requests should take at least ~2000ms
      // because they get serialized by the atomic time slot reservation
      const elapsed = endTime - startTime
      expect(elapsed).toBeGreaterThanOrEqual(1800) // ~2000ms
      expect(elapsed).toBeLessThan(2500)
      // Server should not be called
      expect(apiRequest).not.toHaveBeenCalled()
    })

    it('should generate unique client ID per process', async () => {
      apiRequest
        .mockResolvedValueOnce({ allowed: true, leaseId: 'test-lease-id' })
        .mockResolvedValueOnce({ released: true })

      await waitForRateLimit()

      expect(randomUUID).toHaveBeenCalled()
      expect(apiRequest).toHaveBeenNthCalledWith(
        1,
        'llm/rate-limit/acquire',
        expect.objectContaining({
          body: JSON.stringify({ clientId: 'test-client-id' }),
        }),
      )
    })
  })
})
