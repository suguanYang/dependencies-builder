import { prisma } from '../database/prisma'

export default async function optimizedAutoCreateConnections(): Promise<{
  success: boolean
  createdConnections: number
  skippedConnections: number
  errors: string[]
}> {
  try {
    // Call the native extension function
    const resultRaw = await prisma.$queryRawUnsafe<Array<{ res: string }>>(
      'SELECT auto_create_connections() as res',
    )

    console.log('resultRaw: ', resultRaw)

    if (!resultRaw || resultRaw.length === 0) {
      return {
        success: false,
        createdConnections: 0,
        skippedConnections: 0,
        errors: ['No result from native extension'],
      }
    }

    const jsonString = resultRaw[0].res
    const result = JSON.parse(jsonString)

    return {
      success: true,
      createdConnections: result.createdConnections || 0,
      skippedConnections: result.skippedConnections || 0,
      errors: result.errors || [],
    }
  } catch (err) {
    return {
      success: false,
      createdConnections: 0,
      skippedConnections: 0,
      errors: [`Failed to auto-create connections (native): ${err}`],
    }
  }
}
