import { optimizedAutoCreateConnections } from './create-connections'
import { getNodeDependencyGraph, getProjectLevelDependencyGraph } from '../dependency'
import { prisma } from '../database/prisma'
import { error } from '../logging'

export type DependencyWorkerMessage =
  | { type: 'CALCULATE' }
  | { type: 'GET_NODE_GRAPH'; nodeId: string; opts?: { depth?: number } }
  | { type: 'GET_PROJECT_GRAPH'; projectId: string; branch: string; opts?: { depth?: number } }

/**
 * Worker entry point for dependency operations.
 */
export default async (message: DependencyWorkerMessage) => {
  try {
    switch (message.type) {
      case 'GET_NODE_GRAPH': {
        const result = await getNodeDependencyGraph(message.nodeId, message.opts)
        return { success: true, result }
      }
      case 'GET_PROJECT_GRAPH': {
        const result = await getProjectLevelDependencyGraph(
          message.projectId,
          message.branch,
          message.opts,
        )
        return { success: true, result }
      }
      default:
        throw new Error('Unknown message type')
    }
  } catch (err) {
    error('Dependency worker failed: ' + err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  } finally {
    await prisma.$disconnect()
  }
}
