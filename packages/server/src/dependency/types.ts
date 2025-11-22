import { NodeType, AppType } from '../generated/prisma/client'

// For dependency layer - only graph-related properties
export interface GraphNode {
  id: string
  name: string
  type: NodeType | AppType // Can be either NodeType or AppType
  projectName?: string
  projectId?: string
  branch: string
  relativePath?: string
  startLine?: number
  startColumn?: number
  // Optional fields for project entities
  addr?: string
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
