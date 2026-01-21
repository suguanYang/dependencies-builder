import debug from '../utils/debug'
import { apiRequest } from '../api'
import { randomUUID } from 'node:crypto'

// Log rate limit configuration on module load
const configuredRPM = parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10)
const useServerRateLimit = process.env.LLM_USE_SERVER_RATE_LIMIT !== 'false'
debug(
  `Rate limit configuration: ${configuredRPM} RPM, server-side coordination: ${useServerRateLimit ? 'enabled' : 'disabled'}`,
)

/**
 * Rate limiter for LLM API calls
 * Prevents 429 (Too Many Requests) errors by limiting concurrent requests
 */

// Configurable concurrent request limit
function getConcurrentLimit(): number {
  return parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10)
}

// Track next available request time (reserved slot) for fallback local rate limiting
let nextAvailableTime = 0

// Unique client ID for this process to identify rate limit usage
let clientId: string | null = null
function getClientId(): string {
  if (!clientId) {
    clientId = randomUUID()
  }
  return clientId
}

// Whether to use server-side rate limiting (can be disabled via env var)
function getUseServerRateLimit(): boolean {
  return process.env.LLM_USE_SERVER_RATE_LIMIT !== 'false'
}

interface RateLimitAcquireResponse {
  allowed: boolean
  leaseId?: string
  waitTimeMs?: number
}

interface RateLimitReleaseResponse {
  released: boolean
  message?: string
}

/**
 * Try to acquire rate limit lease from server
 * Throws error if server request fails (network error, etc.)
 */
async function acquireRateLimitFromServer(): Promise<RateLimitAcquireResponse> {
  const response = await apiRequest<RateLimitAcquireResponse>('llm/rate-limit/acquire', {
    method: 'POST',
    body: JSON.stringify({ clientId: getClientId() }),
  })
  return response
}

/**
 * Release a rate limit lease on server
 */
async function releaseRateLimitToServer(leaseId: string): Promise<RateLimitReleaseResponse> {
  const response = await apiRequest<RateLimitReleaseResponse>('llm/rate-limit/release', {
    method: 'PUT',
    body: JSON.stringify({ leaseId }),
  })
  return response
}

/**
 * Local rate limiting (per-process) - fallback time-based limiting
 */
async function waitForLocalRateLimit(): Promise<void> {
  const minIntervalMs = (60 * 1000) / getConcurrentLimit()
  const now = Date.now()
  const reservedTime = Math.max(nextAvailableTime, now)
  nextAvailableTime = reservedTime + minIntervalMs

  const waitTime = reservedTime - now
  if (waitTime > 0) {
    debug(`⏱️  Local rate limit: waiting ${Math.round(waitTime)}ms before next request`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  } else {
    debug('Local rate limit: immediate passage (no wait required)')
  }
}

/**
 * Acquire a rate limit lease for an LLM request
 * Returns a release function that must be called when the request completes
 *
 * This function uses server-side concurrent rate limiting when enabled (LLM_USE_SERVER_RATE_LIMIT !== 'false'),
 * otherwise uses local per-process time-based rate limiting.
 * Server-side rate limiting throws errors on network failures to ensure strict coordination.
 */
export async function acquireRateLimit(): Promise<() => Promise<void>> {
  if (getUseServerRateLimit()) {
    // Server-side concurrent rate limiting (strict coordination across processes)
    let leaseId: string | undefined

    try {
      const serverResponse = await acquireRateLimitFromServer()
      if (serverResponse.allowed && serverResponse.leaseId) {
        // Server allowed the request immediately
        leaseId = serverResponse.leaseId
        debug('✅ Server rate limit lease acquired', { leaseId })

        // Return release function
        return async () => {
          try {
            const releaseResponse = await releaseRateLimitToServer(leaseId!)
            if (releaseResponse.released) {
              debug('✅ Server rate limit lease released', { leaseId })
            } else {
              debug('⚠️  Server rate limit lease already released or not found', {
                leaseId,
                message: releaseResponse.message,
              })
            }
          } catch (error) {
            debug('Failed to release rate limit lease: %o', error)
            // Don't throw - lease will expire automatically after timeout
          }
        }
      } else {
        // Server denied, need to wait for waitTimeMs
        const waitTime = serverResponse.waitTimeMs || 1000
        debug(
          `⏱️  Server rate limit: waiting ${Math.round(waitTime)}ms before retry (no available slots)`,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        // Retry acquisition after waiting
        return acquireRateLimit()
      }
    } catch (error) {
      debug('Server rate limiting failed: %o', error)
      throw new Error(
        `Rate limiting coordination failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    // Local rate limiting (per-process, time-based for testing or single-process scenarios)
    debug('Using local rate limiting (server-side coordination disabled)')
    await waitForLocalRateLimit()
    // Return a no-op release function for local limiting
    return async () => {
      debug('Local rate limit request completed (no lease to release)')
    }
  }
}

/**
 * Wait if necessary to respect rate limit (legacy compatibility)
 * @deprecated Use acquireRateLimit() instead for proper lease management
 */
export async function waitForRateLimit(): Promise<void> {
  const release = await acquireRateLimit()
  // Immediately release since legacy code doesn't manage leases
  // This is not ideal but maintains backward compatibility
  await release()
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  nextAvailableTime = 0
  clientId = null
}
