import { prisma } from '../database/prisma'
import path from 'node:path'
import os from 'node:os'

import { cache } from '../cache/instance'

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
  const useCache = projectId === '*'
  const cacheKey = `projects/graphs/${branch}`

  if (useCache) {
    try {
      const cachedData = await cache.get(cacheKey)
      if (cachedData) {
        return cachedData
      }
    } catch (e) {
      // Ignore read errors
      console.warn(`Failed to read cache: ${e}`)
    }
  }

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

  if (useCache) {
    try {
      // json is already a string
      await cache.set(cacheKey, json)
    } catch (e) {
      console.warn(`Failed to write cache: ${e}`)
    }
  }

  return json
}
