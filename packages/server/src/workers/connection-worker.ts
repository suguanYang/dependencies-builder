import { parentPort } from 'node:worker_threads'
import { optimizedAutoCreateConnections } from './create-connections'
import { prisma } from '../database/prisma'
import { info, error } from '../logging'

/**
 * Worker function for connection auto-creation
 * This runs in a separate thread to avoid blocking the main thread
 */
export default async function connectionWorker({ actionId }: { actionId: string }): Promise<{
  success: boolean
  result?: {
    createdConnections: number
    skippedConnections: number
    errors: string[]
    cycles: string[][]
  }
  error?: string
}> {
  info(`Executing connection auto-create task (Action ID: ${actionId})`)
  try {
    // Update action status to running
    await prisma.action.update({
      where: { id: actionId },
      data: { status: 'running' },
    })

    // Execute the optimized connection auto-creation
    const result = await optimizedAutoCreateConnections()

    // Update action with result
    await prisma.action.update({
      where: { id: actionId },
      data: {
        status: 'completed',
        result: result,
        updatedAt: new Date(),
      },
    })

    info(`Completed connection auto-create task (Action ID: ${actionId})`)

    return {
      success: true,
      result,
    }
  } catch (err) {
    error(`Failed to execute connection auto-create task (Action ID: ${actionId})`)
    // Update action with error
    try {
      await prisma.action.update({
        where: { id: actionId },
        data: {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          updatedAt: new Date(),
        },
      })
    } catch (updateError) {
      // Log but don't fail if update fails
      error(
        'Failed to update action status:' +
          (updateError instanceof Error ? updateError.message : 'Unknown error'),
      )
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    await prisma.$disconnect()
  }
}
