import { parentPort } from 'node:worker_threads'
import { PrismaClient } from '../generated/prisma/client'
import { optimizedAutoCreateConnections } from './create-connections'

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
  }
  error?: string
}> {
  let prisma: PrismaClient | null = null

  try {
    // Create a new Prisma client instance for this worker
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    })

    // Update action status to running
    await prisma.action.update({
      where: { id: actionId },
      data: { status: 'running' },
    })

    // Execute the optimized connection auto-creation
    const result = await optimizedAutoCreateConnections(prisma)

    // Update action with result
    await prisma.action.update({
      where: { id: actionId },
      data: {
        status: 'completed',
        result: result,
        updatedAt: new Date(),
      },
    })

    return {
      success: true,
      result,
    }
  } catch (error) {
    // Update action with error
    if (prisma) {
      try {
        await prisma.action.update({
          where: { id: actionId },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        })
      } catch (updateError) {
        // Log but don't fail if update fails
        console.error('Failed to update action status:', updateError)
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    // Clean up Prisma client
    if (prisma) {
      await prisma.$disconnect()
    }
  }
}

// Handle messages from parent thread
if (parentPort) {
  parentPort.on('message', async (message: { actionId: string }) => {
    try {
      const result = await connectionWorker({ actionId: message.actionId })
      parentPort!.postMessage(result)
    } catch (error) {
      parentPort!.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
