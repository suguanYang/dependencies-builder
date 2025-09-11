import { NodeType } from '../generated/prisma'

export interface NodeQuery {
  project?: string
  branch?: string
  type?: NodeType
  name?: string
  limit?: number
  offset?: number
}

export interface NodeCreationBody {
  project: string
  branch: string
  type: NodeType
  name: string
  relativePath: string
  startLine: number
  startColumn: number
  version: string
  meta: Record<string, string>
}

export interface ConnectionQuery {
  fromId?: string
  toId?: string
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
