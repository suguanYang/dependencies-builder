import { GraphNode, GraphConnection, DependencyGraph } from './types'
import { buildDependencyGraph } from './graph'
import * as repository from '../database/repository'
import { Project } from '../generated/prisma/client'

// Custom error class for not found errors
class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export const validateEdgeCreation = (fromNode: GraphNode, toNode: GraphNode): boolean => {
  // Basic validation: ensure nodes are of compatible types
  const validTypePairs: Record<string, string[]> = {
    NamedImport: ['NamedExport'],
    RuntimeDynamicImport: ['NamedExport'],
    EventOn: ['EventEmit'],
    DynamicModuleFederationReference: ['NamedExport'],
  }

  const allowedTargets = validTypePairs[fromNode.type]
  return allowedTargets ? allowedTargets.includes(toNode.type) : false
}

export const getNodeDependencyGraph = async (
  nodeId: string
): Promise<DependencyGraph> => {
  const maxDepth = 100

  const visitedNodes = new Map<string, GraphNode>()
  const allConnections = new Map<string, GraphConnection>()

  // DFS traversal with incremental database queries
  const stack: { nodeId: string; depth: number }[] = [{ nodeId, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.depth >= maxDepth) {
      continue
    }

    // Get connections for current node in both directions
    const [outgoingConnectionsResult, incomingConnectionsResult] = await Promise.all([
      repository.getConnections({
        where: { fromId: { in: [current.nodeId] } }
      }),
      repository.getConnections({
        where: { toId: { in: [current.nodeId] } }
      })
    ])

    const connections = [...outgoingConnectionsResult.data, ...incomingConnectionsResult.data]

    // Process connections and add new nodes to stack
    for (const conn of connections) {
      const connection: GraphConnection = {
        id: conn.id,
        fromId: conn.fromId,
        toId: conn.toId,
      }

      // Only add connection if both nodes are in our graph
      if (allConnections.has(connection.id)) {
        continue
      }

      // Process target node (the one we haven't visited yet)
      const targetNodeId = visitedNodes.has(conn.fromId) ? conn.toId : conn.fromId
      if (!visitedNodes.has(targetNodeId)) {
        // Fetch the target node from database
        const targetNode = await repository.getNodeById(targetNodeId)
        if (!targetNode) {
          continue
        }

        // Convert to GraphNode format
        const targetGraphNode: GraphNode = {
          ...targetNode,
        }

        visitedNodes.set(targetNodeId, targetGraphNode)
        stack.push({ nodeId: targetNodeId, depth: current.depth + 1 })

        allConnections.set(connection.id, connection)
      }
    }
  }

  // Build the final graph
  const reachableNodes = Array.from(visitedNodes.values())

  return buildDependencyGraph(reachableNodes, Array.from(allConnections.values()))
}

export const getProjectLevelDependencyGraph = async (
  projectId: string,
  branch: string,
  opts?: {
    depth?: number
  }
): Promise<DependencyGraph> => {
  const maxDepth = opts?.depth ?? 100

  // Step 1: Get project information
  const project = await repository.getProjectById(projectId)
  if (!project) {
    throw new NotFoundError(`Project with ID ${projectId} not found`)
  }

  const visitedProjects = new Map<string, { branch: string } & Project>()
  const projectConnections = new Map<string, GraphConnection>()
  const queue: { projectId: string; depth: number }[] = [{ projectId, depth: 0 }]

  // BFS traversal for project-level dependencies
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    // Get all nodes for current project
    const currentProjectNodes = await repository.getNodes({
      where: { projectId: current.projectId, branch },
      select: {
        id: true,
        branch: true
      }
    })

    const currentNodeIds = currentProjectNodes.data.map(node => node.id)

    const newProjectsToAdd: string[] = []

    // Get connections that cross project boundaries
    const crossProjectConnectionsResult = await repository.getConnections({
      where: {
        OR: [
          { fromId: { in: currentNodeIds } },
          { toId: { in: currentNodeIds } }
        ]
      },
      select: {
        fromNode: {
          select: {
            projectId: true
          }
        },
        toNode: {
          select: {
            projectId: true
          }
        }
      }
    })

    for (const conn of crossProjectConnectionsResult.data) {
      const fromNode = conn.fromNode
      const toNode = conn.toNode

      // Only consider connections between different projects
      if (fromNode.projectId !== toNode.projectId) {
        const sourceProjectId = fromNode.projectId
        const targetProjectId = toNode.projectId

        // Add the connection
        const connectionId = `${sourceProjectId}-${targetProjectId}`

        if (projectConnections.has(connectionId)) {
          continue
        }

        newProjectsToAdd.push(...[sourceProjectId, targetProjectId].filter(
          pid => !visitedProjects.has(pid)
        ))

        projectConnections.set(connectionId, {
          id: connectionId,
          fromId: sourceProjectId,
          toId: targetProjectId,
        })
      }
    }

    const projects = await repository.getProjects({
      where: {
        id: {
          in: newProjectsToAdd
        }
      }
    })

    projects.data.forEach(newProject => {
      visitedProjects.set(newProject.id, {
        ...newProject,
        branch: currentProjectNodes.data[0]?.branch,
      })
      queue.push({ projectId: newProject.id, depth: current.depth + 1 })
    });

  }

  // Create project-level nodes using actual project entities
  const projectLevelNodes: GraphNode[] = []

  for (const [_, info] of visitedProjects.entries()) {
    // Fetch the actual project entity to get its proper type
    if (project) {
      projectLevelNodes.push(info)
    }
  }

  return buildDependencyGraph(projectLevelNodes, Array.from(projectConnections.values()))
}
