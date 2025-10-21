import { NodeType } from '../generated/prisma/client'

export interface NodeQuery {
  projectName?: string
  branch?: string
  type?: NodeType
  name?: string
  standalone?: boolean
  limit?: number
  offset?: number
}

export interface NodeCreationBody {
  projectName: string
  branch: string
  type: NodeType
  name: string
  relativePath: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  version: string
  meta: Record<string, string>
}

export interface ConnectionQuery {
  fromId?: string
  toId?: string
  fromNodeName?: string
  toNodeName?: string
  fromNodeProjectName?: string
  toNodeProjectName?: string
  fromNodeType?: string
  toNodeType?: string
  limit?: number
  offset?: number
}

export interface ProjectQuery {
  name?: string
  addr?: string
  limit?: number
  offset?: number
}

export interface ProjectCreationBody {
  name: string
  addr: string
  entries?: Record<string, any>
}

export interface ProjectUpdateBody {
  name?: string
  url?: string
  entries?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
