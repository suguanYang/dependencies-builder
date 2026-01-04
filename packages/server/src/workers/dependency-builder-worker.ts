import { prisma } from '../database/prisma'
import { error } from '../logging'

const getNodeDependencyGraph = async (
  nodeId: string,
  opts?: { depth?: number },
): Promise<string> => {
  const depth = opts?.depth ?? 100
  // Call Native Function via SQL
  // The native function returns a JSON string directly.
  const result = await prisma.$queryRawUnsafe<Array<{ json: string }>>(
    `SELECT get_node_dependency_graph(?, ?) as json`,
    nodeId,
    depth,
  )

  if (!result || result.length === 0 || !result[0].json) {
    // Return empty graph JSON if no result
    return JSON.stringify({ vertices: [], edges: [] })
  }

  // Return raw JSON string directly for performance
  return result[0].json
}

const getProjectLevelDependencyGraph = async (
  projectId: string,
  branch: string,
  opts?: { depth?: number },
): Promise<string> => {
  const depth = opts?.depth ?? 100

  const result = await prisma.$queryRawUnsafe<Array<{ json: string }>>(
    `SELECT get_project_dependency_graph(?, ?, ?) as json`,
    projectId,
    branch,
    depth,
  )

  if (!result || result.length === 0 || !result[0].json) {
    return JSON.stringify({ vertices: [], edges: [] })
  }

  const json = result[0].json

  return json
}

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
        // result is already wrapped with move() for efficient transfer
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
