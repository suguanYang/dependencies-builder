import debug from '../utils/debug'

/**
 * Rate limiter for LLM API calls
 * Prevents 429 (Too Many Requests) errors by limiting requests per minute
 */

// Configurable rate limit (requests per minute)
const REQUESTS_PER_MINUTE = parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10)

// Convert to milliseconds between requests
const MIN_INTERVAL_MS = (60 * 1000) / REQUESTS_PER_MINUTE

// Track next available request time (reserved slot)
let nextAvailableTime = 0

/**
 * Wait if necessary to respect rate limit
 * Call this before making each LLM API request
 *
 * This function is safe to call concurrently - it atomically reserves
 * time slots to ensure requests are properly spaced according to rate limits.
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now()

  // Atomically reserve the next available time slot
  // This prevents race conditions when called concurrently
  const reservedTime = Math.max(nextAvailableTime, now)
  nextAvailableTime = reservedTime + MIN_INTERVAL_MS

  // Wait until our reserved time slot
  const waitTime = reservedTime - now
  if (waitTime > 0) {
    debug(`⏱️  Rate limit: waiting ${Math.round(waitTime)}ms before next request`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  nextAvailableTime = 0
}
