import { GraphNode, GraphConnection, DependencyGraph } from './types'
import { buildDependencyGraph } from './graph'
import * as repository from '../database/repository'

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

export const getProjectDependencyGraph = (
  projectName: string,
  branch: string,
  nodes: any[],
  connections: any[],
): DependencyGraph => {
  // Convert nodes to GraphNode format
  const graphNodes: GraphNode[] = nodes.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    projectName: node.projectName,
    projectId: node.projectId,
    branch: node.branch,
  }))

  // Convert connections to GraphConnection format
  const graphConnections: GraphConnection[] = connections.map(conn => ({
    id: conn.id,
    fromId: conn.fromId,
    toId: conn.toId,
  }))

  // Filter nodes for the specific project and branch
  const projectNodes = graphNodes.filter(
    (node) => node.projectName === projectName && node.branch === branch,
  )

  if (projectNodes.length === 0) {
    throw new NotFoundError(`No nodes found for project '${projectName}' on branch '${branch}'`)
  }

  // Get all connections involving these nodes
  const projectConnections = graphConnections.filter((conn) =>
    projectNodes.some((node) => node.id === conn.fromId || node.id === conn.toId),
  )

  return buildDependencyGraph(projectNodes, projectConnections)
}

export const getNodeDependencyGraph = async (
  nodeId: string
): Promise<DependencyGraph> => {
  const maxDepth = 100

  // Step 1: Get the starting node
  const startNode = await repository.getNodeById(nodeId)
  if (!startNode) {
    throw new NotFoundError(`Node with ID ${nodeId} not found`)
  }

  // Convert to GraphNode format
  const startGraphNode: GraphNode = {
    ...startNode,
    createdAt: startNode.createdAt.toISOString(),
    updatedAt: startNode.updatedAt.toISOString(),
  }

  const visitedNodes = new Map<string, GraphNode>()
  const allConnections: GraphConnection[] = []

  visitedNodes.set(nodeId, startGraphNode)

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
      if (visitedNodes.has(conn.fromId) && visitedNodes.has(conn.toId)) {
        allConnections.push(connection)
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
          createdAt: targetNode.createdAt.toISOString(),
          updatedAt: targetNode.updatedAt.toISOString(),
        }

        visitedNodes.set(targetNodeId, targetGraphNode)
        stack.push({ nodeId: targetNodeId, depth: current.depth + 1 })
      }
    }
  }

  // Build the final graph
  const reachableNodes = Array.from(visitedNodes.values())
  return buildDependencyGraph(reachableNodes, allConnections)
}

export const getProjectLevelDependencyGraph = async (
  projectId: string
): Promise<DependencyGraph> => {
  const maxDepth = 100
  const batchSize = 1000

  // Step 1: Get project information
  const project = await repository.getProjectById(projectId)
  if (!project) {
    throw new NotFoundError(`Project with ID ${projectId} not found`)
  }

  // Step 2: Get all nodes for this project
  const projectNodes = await repository.getNodes({
    where: { projectId }
  })

  if (projectNodes.data.length === 0) {
    throw new NotFoundError(`No nodes found for project ID ${projectId}`)
  }

  const visitedProjects = new Map<string, { name: string; branch: string }>()
  const projectConnections: GraphConnection[] = []
  const queue: { projectId: string; depth: number }[] = [{ projectId, depth: 0 }]

  visitedProjects.set(projectId, {
    name: project.name,
    branch: projectNodes.data[0].branch
  })

  // BFS traversal for project-level dependencies
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) {
      continue
    }

    // Get all nodes for current project
    const currentProjectNodes = await repository.getNodes({
      where: { projectId: current.projectId }
    })

    const currentNodeIds = currentProjectNodes.data.map(node => node.id)

    // Process in batches
    for (let i = 0; i < currentNodeIds.length; i += batchSize) {
      const batch = currentNodeIds.slice(i, i + batchSize)

      // Get connections that cross project boundaries
      const crossProjectConnectionsResult = await repository.getConnections({
        where: {
          OR: [
            { fromId: { in: batch } },
            { toId: { in: batch } }
          ]
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
          if (!projectConnections.some(c => c.id === connectionId)) {
            projectConnections.push({
              id: connectionId,
              fromId: sourceProjectId,
              toId: targetProjectId,
            })
          }

          // Add new projects to the queue if not visited
          const projectsToAdd = [sourceProjectId, targetProjectId].filter(
            pid => !visitedProjects.has(pid) && pid !== current.projectId
          )

          for (const newProjectId of projectsToAdd) {
            // Get project info for the new project
            const newProject = await repository.getProjectById(newProjectId)
            if (newProject) {
              // Get a sample node to determine branch
              const sampleNodes = await repository.getNodes({
                where: { projectId: newProjectId },
                take: 1
              })

              visitedProjects.set(newProjectId, {
                name: newProject.name,
                branch: sampleNodes.data[0]?.branch || 'main'
              })

              queue.push({ projectId: newProjectId, depth: current.depth + 1 })
            }
          }
        }
      }
    }
  }

  // Create project-level nodes using actual project entities
  const projectLevelNodes: GraphNode[] = []

  for (const [projectId, info] of visitedProjects.entries()) {
    // Fetch the actual project entity to get its proper type
    const project = await repository.getProjectById(projectId)
    if (project) {
      projectLevelNodes.push({
        id: project.id,
        name: project.name,
        type: project.type, // This is AppType (Lib or App)
        projectName: project.name,
        projectId: project.id,
        branch: info.branch,
        addr: project.addr,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      })
    }
  }

  return buildDependencyGraph(projectLevelNodes, projectConnections)
}
