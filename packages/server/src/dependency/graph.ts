// we are using orthogonnal list to represent the dependency graph

import { info } from '../logging'
import { DependencyGraph, GraphConnection, GraphNode } from './types'

interface OrthogonalGraph {
  vertices: {
    data: GraphNode
    firstIn: number
    firstOut: number
    inDegree: number
    outDegree: number
  }[]
  edges: {
    data: GraphConnection
    tailvertex: number
    headvertex: number
    headnext: number
    tailnext: number
  }[]
}

const buildOrthogonalGraph = (
  nodes: GraphNode[],
  connections: GraphConnection[],
): OrthogonalGraph => {
  const vertices: OrthogonalGraph['vertices'] = []
  const edges: OrthogonalGraph['edges'] = []
  const nodeIndexMap = new Map<string, number>()

  // Create vertices and map node IDs to indices
  nodes.forEach((node, index) => {
    nodeIndexMap.set(node.id, index)
    vertices.push({
      data: node,
      firstIn: -1,
      firstOut: -1,
      inDegree: 0,
      outDegree: 0
    })
  })

  // Create edges and build orthogonal list
  connections.forEach((connection) => {
    const fromIndex = nodeIndexMap.get(connection.fromId)
    const toIndex = nodeIndexMap.get(connection.toId)

    if (fromIndex === undefined || toIndex === undefined) return

    const edgeIndex = edges.length
    const edge = {
      data: connection,
      tailvertex: fromIndex,
      headvertex: toIndex,
      headnext: -1,
      tailnext: -1,
    }

    // Link to head vertex's incoming edges
    if (vertices[toIndex].firstIn === -1) {
      vertices[toIndex].firstIn = edgeIndex
      vertices[toIndex].inDegree++
    } else {
      let currentEdgeIndex = vertices[toIndex].firstIn
      while (edges[currentEdgeIndex].headnext !== -1) {
        currentEdgeIndex = edges[currentEdgeIndex].headnext
      }
      edges[currentEdgeIndex].headnext = edgeIndex
      vertices[toIndex].inDegree++
    }

    // Link to tail vertex's outgoing edges
    if (vertices[fromIndex].firstOut === -1) {
      vertices[fromIndex].firstOut = edgeIndex
      vertices[fromIndex].outDegree++
    } else {
      let currentEdgeIndex = vertices[fromIndex].firstOut
      while (edges[currentEdgeIndex].tailnext !== -1) {
        currentEdgeIndex = edges[currentEdgeIndex].tailnext
      }
      edges[currentEdgeIndex].tailnext = edgeIndex
      vertices[fromIndex].outDegree++
    }

    edges.push(edge)
  })

  return { vertices, edges }
}

const dfsOrthogonal = (
  graph: OrthogonalGraph,
  startVertexIndex: number,
  callback: (node: GraphNode) => void,
  visited = new Set<number>(),
): void => {
  if (visited.has(startVertexIndex)) return

  const vertex = graph.vertices[startVertexIndex]
  if (!vertex) return

  visited.add(startVertexIndex)
  callback(vertex.data)

  // Traverse outgoing edges (dependencies)
  let edgeIndex = vertex.firstOut
  while (edgeIndex !== -1) {
    const edge = graph.edges[edgeIndex]
    if (edge) {
      dfsOrthogonal(graph, edge.headvertex, callback, visited)
      edgeIndex = edge.tailnext
    }
  }
}

const bfsOrthogonal = (
  graph: OrthogonalGraph,
  startVertexIndex: number,
  callback: (node: GraphNode) => void,
): void => {
  const visited = new Set<number>()
  const queue: number[] = [startVertexIndex]
  visited.add(startVertexIndex)

  while (queue.length > 0) {
    const currentVertexIndex = queue.shift()!
    const vertex = graph.vertices[currentVertexIndex]

    if (vertex) {
      callback(vertex.data)
    }

    // Add all neighbors from outgoing edges
    let edgeIndex = vertex.firstOut
    while (edgeIndex !== -1) {
      const edge = graph.edges[edgeIndex]
      if (edge && !visited.has(edge.headvertex)) {
        visited.add(edge.headvertex)
        queue.push(edge.headvertex)
      }
      edgeIndex = edge.tailnext
    }
  }
}

const getIncomingEdges = (graph: OrthogonalGraph, vertexIndex: number): GraphConnection[] => {
  const edges: GraphConnection[] = []
  let edgeIndex = graph.vertices[vertexIndex]?.firstIn

  while (edgeIndex !== -1) {
    const edge = graph.edges[edgeIndex]
    if (edge) {
      edges.push(edge.data)
      edgeIndex = edge.headnext
    }
  }

  return edges
}

const getOutgoingEdges = (graph: OrthogonalGraph, vertexIndex: number): GraphConnection[] => {
  const edges: GraphConnection[] = []
  let edgeIndex = graph.vertices[vertexIndex]?.firstOut

  while (edgeIndex !== -1) {
    const edge = graph.edges[edgeIndex]
    if (edge) {
      edges.push(edge.data)
      edgeIndex = edge.tailnext
    }
  }

  return edges
}

export const buildDependencyGraph = (
  nodes: GraphNode[],
  connections: GraphConnection[],
): DependencyGraph => {
  const start = performance.now()
  const orthogonalGraph = buildOrthogonalGraph(nodes, connections)
  info(`build dependency graph for ${nodes.length} nodes in ${performance.now() - start} ms`)

  return {
    vertices: orthogonalGraph.vertices,
    edges: orthogonalGraph.edges,
  }
}

export { dfsOrthogonal, bfsOrthogonal, getIncomingEdges, getOutgoingEdges }
