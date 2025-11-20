import { GraphNode, GraphConnection, DependencyGraph } from './types'
import { buildDependencyGraph, dfsOrthogonal } from './graph'

export const getFullDependencyGraph = (
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

  const graph = buildDependencyGraph(graphNodes, graphConnections)
  return graph
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

  // Get all connections involving these nodes
  const projectConnections = graphConnections.filter((conn) =>
    projectNodes.some((node) => node.id === conn.fromId || node.id === conn.toId),
  )

  return buildDependencyGraph(projectNodes, projectConnections)
}

export const getNodeDependencyGraph = (
  nodeId: string,
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

  // Build the full graph
  const fullGraph = buildDependencyGraph(graphNodes, graphConnections)

  // Find the starting node index
  const startNodeIndex = fullGraph.vertices.findIndex(vertex => vertex.data.id === nodeId)

  if (startNodeIndex === -1) {
    throw new Error(`Node with ID ${nodeId} not found`)
  }

  // Use DFS to find all reachable nodes from the starting node
  const visitedNodes = new Set<number>()
  const reachableNodes: GraphNode[] = []

  dfsOrthogonal(
    fullGraph,
    startNodeIndex,
    (node) => {
      reachableNodes.push(node)
    },
    visitedNodes
  )

  // Get all connections between the reachable nodes
  const reachableNodeIds = new Set(reachableNodes.map(node => node.id))
  const reachableConnections = graphConnections.filter(
    conn => reachableNodeIds.has(conn.fromId) && reachableNodeIds.has(conn.toId)
  )

  // Build the subgraph with only reachable nodes and connections
  return buildDependencyGraph(reachableNodes, reachableConnections)
}

export const getProjectLevelDependencyGraph = (
  projectId: string,
  nodes: any[], // Using any[] to handle the full Prisma node structure
  connections: any[], // Using any[] to handle the full Prisma connection structure
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

  // Get all nodes for the given project
  const projectNodes = graphNodes.filter(node => node.projectId === projectId)

  if (projectNodes.length === 0) {
    throw new Error(`No nodes found for project ID ${projectId}`)
  }

  // Find all connections that involve this project's nodes
  const projectNodeIds = new Set(projectNodes.map(node => node.id))
  const relevantConnections = graphConnections.filter(
    conn => projectNodeIds.has(conn.fromId) || projectNodeIds.has(conn.toId)
  )

  // Find all projects that are connected to this project
  const connectedProjectIds = new Set<string>()

  relevantConnections.forEach(conn => {
    // Find the project of the connected node
    const connectedNodeId = projectNodeIds.has(conn.fromId) ? conn.toId : conn.fromId
    const connectedNode = graphNodes.find(node => node.id === connectedNodeId)

    if (connectedNode && connectedNode.projectId !== projectId) {
      connectedProjectIds.add(connectedNode.projectId)
    }
  })

  // Create project-level nodes
  const projectLevelNodes: GraphNode[] = [
    // Add the current project
    {
      id: projectId,
      name: projectNodes[0].projectName,
      type: 'NamedExport' as any, // Using a placeholder type for projects
      projectName: projectNodes[0].projectName,
      projectId: projectId,
      branch: projectNodes[0].branch,
    },
    // Add connected projects
    ...Array.from(connectedProjectIds).map(connectedProjectId => {
      const connectedProjectNode = graphNodes.find(node => node.projectId === connectedProjectId)
      return {
        id: connectedProjectId,
        name: connectedProjectNode?.projectName || 'Unknown Project',
        type: 'NamedExport' as any,
        projectName: connectedProjectNode?.projectName || 'Unknown Project',
        projectId: connectedProjectId,
        branch: connectedProjectNode?.branch || 'main',
      }
    })
  ]

  // Create project-level connections
  const projectLevelConnections: GraphConnection[] = []

  relevantConnections.forEach(conn => {
    const fromNode = graphNodes.find(node => node.id === conn.fromId)
    const toNode = graphNodes.find(node => node.id === conn.toId)

    if (fromNode && toNode && fromNode.projectId !== toNode.projectId) {
      // Only create connections between different projects
      const connectionId = `${fromNode.projectId}-${toNode.projectId}`

      // Avoid duplicate connections
      if (!projectLevelConnections.some(c => c.id === connectionId)) {
        projectLevelConnections.push({
          id: connectionId,
          fromId: fromNode.projectId,
          toId: toNode.projectId,
        })
      }
    }
  })

  return buildDependencyGraph(projectLevelNodes, projectLevelConnections)
}
