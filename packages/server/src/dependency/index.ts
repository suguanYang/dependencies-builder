import { prisma } from '../database/prisma'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DMS_LOCAL_DIR = process.env.DMS_LOCAL_DIR || path.join(os.homedir(), '.dms')
const CACHE_DIR = path.join(DMS_LOCAL_DIR, 'cache')

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

  if (useCache) {
    const cacheFile = path.join(CACHE_DIR, `project-graph-${branch}.json`)
    try {
      if (fs.existsSync(cacheFile)) {
        // Evaluate if cache is valid?
        // User request: "cache key should be branch name", implies simple key.
        // Invalidation logic isn't specified, assuming simple read/write.
        const cachedData = await fs.promises.readFile(cacheFile, 'utf-8')
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
    const cacheFile = path.join(CACHE_DIR, `project-graph-${branch}.json`)
    try {
      await fs.promises.mkdir(CACHE_DIR, { recursive: true })
      await fs.promises.writeFile(cacheFile, json, 'utf-8')
    } catch (e) {
      console.warn(`Failed to write cache: ${e}`)
    }
  }

  return json
}
