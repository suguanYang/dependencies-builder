// we are using orthogonnal list to represent the dependency graph

import { DependencyGraph, GraphConnection, GraphNode } from './types'

const buildDependencyGraph = (nodes: GraphNode[], connections: GraphConnection[]) => {
  const graph: DependencyGraph = {
    vertices: [],
    edges: [],
  }

  return graph
}
