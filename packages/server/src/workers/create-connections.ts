import { prisma } from '../database/prisma'

export async function optimizedAutoCreateConnections(): Promise<{
  createdConnections: number
  skippedConnections: number
  errors: string[]
  cycles: string[][]
}> {
  try {
    // Call the native extension function
    const resultRaw = await prisma.$queryRawUnsafe<Array<{ res: string }>>(
      'SELECT auto_create_connections() as res',
    )

    if (!resultRaw || resultRaw.length === 0) {
      return {
        createdConnections: 0,
        skippedConnections: 0,
        errors: ['No result from native extension'],
        cycles: [],
      }
    }

    const jsonString = resultRaw[0].res
    const result = JSON.parse(jsonString)

    return {
      createdConnections: result.createdConnections || 0,
      skippedConnections: result.skippedConnections || 0,
      errors: result.errors || [],
      cycles: result.cycles || [],
    }
  } catch (error) {
    return {
      createdConnections: 0,
      skippedConnections: 0,
      errors: [`Failed to auto-create connections (native): ${error}`],
      cycles: [],
    }
  }
}
