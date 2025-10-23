import { GraphNode, GraphConnection, DependencyGraph } from './types'
import { buildDependencyGraph } from './graph'

export const getFullDependencyGraph = (
  nodes: GraphNode[],
  connections: GraphConnection[],
): DependencyGraph => {
  const graph = buildDependencyGraph(nodes, connections)
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
  nodes: GraphNode[],
  connections: GraphConnection[],
): DependencyGraph => {
  // Filter nodes for the specific project and branch
  const projectNodes = nodes.filter(
    (node) => node.projectName === projectName && node.branch === branch,
  )

  // Get all connections involving these nodes
  const projectConnections = connections.filter((conn) =>
    projectNodes.some((node) => node.id === conn.fromId || node.id === conn.toId),
  )

  return buildDependencyGraph(projectNodes, projectConnections)
}
