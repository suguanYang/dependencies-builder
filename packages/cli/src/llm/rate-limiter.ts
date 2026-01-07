import debug from '../utils/debug'

/**
 * Rate limiter for LLM API calls
 * Prevents 429 (Too Many Requests) errors by limiting requests per minute
 */

// Configurable rate limit (requests per minute)
const REQUESTS_PER_MINUTE = parseInt(process.env.LLM_REQUESTS_PER_MINUTE || '60', 10)

// Convert to milliseconds between requests
const MIN_INTERVAL_MS = (60 * 1000) / REQUESTS_PER_MINUTE

// Track last request time
let lastRequestTime = 0

/**
 * Wait if necessary to respect rate limit
 * Call this before making each LLM API request
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_INTERVAL_MS) {
    const waitTime = MIN_INTERVAL_MS - timeSinceLastRequest
    debug(`⏱️  Rate limit: waiting ${Math.round(waitTime)}ms before next request`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }

  lastRequestTime = Date.now()
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  lastRequestTime = 0
}
