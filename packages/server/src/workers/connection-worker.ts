import { optimizedAutoCreateConnections } from './create-connections'
import { prisma } from '../database/prisma'
import { info, error } from '../logging'

/**
 * Worker function for connection auto-creation
 * This runs in a separate thread to avoid blocking the main thread
 */
export default async function connectionWorker(): Promise<{
  success: boolean
  result?: {
    createdConnections: number
    skippedConnections: number
    errors: string[]
    cycles: string[][]
  }
  error?: string
}> {
  info(`Executing connection auto-create task`)
  try {
    // Execute the optimized connection auto-creation
    const result = await optimizedAutoCreateConnections()

    info(`Completed connection auto-create task`)

    return {
      success: true,
      result,
    }
  } catch (err) {
    error(`Failed to execute connection auto-create task`)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  } finally {
    await prisma.$disconnect()
  }
}
