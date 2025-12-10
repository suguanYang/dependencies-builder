import { prisma } from '../database/prisma'

export const getNodeDependencyGraph = async (
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

export const getProjectLevelDependencyGraph = async (
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

  return result[0].json
}
