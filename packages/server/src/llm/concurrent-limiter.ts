import { randomUUID } from 'node:crypto'

interface Lease {
  id: string
  clientId?: string
  createdAt: Date
  configKey: string
}

/**
 * In-memory concurrent rate limiter for LLM requests
 * Tracks active requests per configKey to enforce concurrent request limits
 * Uses leases with automatic cleanup for stale requests
 */
export class ConcurrentLimiter {
  private leases = new Map<string, Lease>() // leaseId -> Lease
  private configKeyToLeaseIds = new Map<string, Set<string>>() // configKey -> Set<leaseId>
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly leaseTimeoutMs: number = 10 * 60 * 1000 // 10 minutes default

  constructor(leaseTimeoutMs?: number) {
    if (leaseTimeoutMs) {
      this.leaseTimeoutMs = leaseTimeoutMs
    }
    this.startCleanup()
  }

  /**
   * Try to acquire a lease for a new LLM request
   * @param configKey The configuration key (LLM config ID or 'env')
   * @param clientId Optional client identifier
   * @param maxConcurrent Maximum concurrent requests allowed for this configKey
   * @returns Lease object if acquired, null if limit reached
   */
  acquire(configKey: string, clientId?: string, maxConcurrent: number = 60): Lease | null {
    // Clean up stale leases first
    this.cleanupStaleLeases()

    const activeLeases = this.configKeyToLeaseIds.get(configKey)
    const activeCount = activeLeases?.size ?? 0

    if (activeCount >= maxConcurrent) {
      return null
    }

    const lease: Lease = {
      id: randomUUID(),
      clientId,
      createdAt: new Date(),
      configKey,
    }

    this.leases.set(lease.id, lease)

    if (!activeLeases) {
      this.configKeyToLeaseIds.set(configKey, new Set([lease.id]))
    } else {
      activeLeases.add(lease.id)
    }

    return lease
  }

  /**
   * Release a lease by ID
   * @param leaseId The lease ID to release
   * @returns True if lease was found and released, false otherwise
   */
  release(leaseId: string): boolean {
    const lease = this.leases.get(leaseId)
    if (!lease) {
      return false
    }

    this.leases.delete(leaseId)

    const activeLeases = this.configKeyToLeaseIds.get(lease.configKey)
    if (activeLeases) {
      activeLeases.delete(leaseId)
      if (activeLeases.size === 0) {
        this.configKeyToLeaseIds.delete(lease.configKey)
      }
    }

    return true
  }

  /**
   * Release all leases for a specific client (e.g., when client disconnects)
   * @param clientId The client ID to release leases for
   * @returns Number of leases released
   */
  releaseAllForClient(clientId: string): number {
    let released = 0
    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.clientId === clientId) {
        this.release(leaseId)
        released++
      }
    }
    return released
  }

  /**
   * Get current active lease count for a configKey
   */
  getActiveCount(configKey: string): number {
    return this.configKeyToLeaseIds.get(configKey)?.size ?? 0
  }

  /**
   * Clean up stale leases (older than leaseTimeoutMs)
   */
  private cleanupStaleLeases(): void {
    const now = Date.now()
    const staleLeaseIds: string[] = []

    for (const [leaseId, lease] of this.leases.entries()) {
      if (now - lease.createdAt.getTime() > this.leaseTimeoutMs) {
        staleLeaseIds.push(leaseId)
      }
    }

    for (const leaseId of staleLeaseIds) {
      this.release(leaseId)
    }

    if (staleLeaseIds.length > 0) {
      console.log(`[concurrent-limiter] Cleaned up ${staleLeaseIds.length} stale leases`)
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStaleLeases()
      },
      5 * 60 * 1000,
    )

    // Ensure cleanup stops on process exit
    process.on('exit', () => {
      this.stopCleanup()
    })
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get all active leases (for debugging/monitoring)
   */
  getAllActiveLeases(): Lease[] {
    return Array.from(this.leases.values())
  }

  /**
   * Reset the limiter (for testing)
   */
  reset(): void {
    this.leases.clear()
    this.configKeyToLeaseIds.clear()
  }
}

// Singleton instance
export const concurrentLimiter = new ConcurrentLimiter()
