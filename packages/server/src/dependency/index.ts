import { GraphNode, GraphConnection, DependencyGraph } from './types'

export const getFullDependencyGraph = (
  nodeId: string,
  nodes: GraphNode[],
  connections: GraphConnection[],
): DependencyGraph => {
  throw new Error('Not implemented')
}

export const validateEdgeCreation = (fromNode: GraphNode, toNode: GraphNode): boolean => {
  throw new Error('Not implemented')
}

export const findCircularDependencies = (connections: GraphConnection[]): string[][] => {
  throw new Error('Not implemented')
}
