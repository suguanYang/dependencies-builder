import { NodeType } from '../generated/prisma/client'

// For dependency layer - only graph-related properties
export interface GraphNode {
  id: string
  name: string
  type: NodeType
  projectName: string
  projectId: string
  branch: string
}

export interface GraphConnection {
  id: string
  fromId: string
  toId: string
}

export interface DependencyGraph {
  vertices: {
    data: GraphNode
    firstIn: number
    firstOut: number
  }[]
  edges: {
    data: GraphConnection
    tailvertex: number
    headvertex: number
    headnext: number
    tailnext: number
  }[]
}
