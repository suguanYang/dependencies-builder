import { AppType, NodeType } from '../generated/prisma/client'

export interface NodeQuery {
  projectName?: string
  branch?: string
  type?: NodeType
  name?: string
  standalone?: boolean | string
  limit?: number
  offset?: number
}

export interface NodeCreationBody {
  projectId?: string
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
  qlsVersion: string
  meta: Record<string, string>
}

export interface NodeBatchCreationBody {
  shallowBranch: string
  data: NodeCreationBody[]
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
  type?: AppType
}

export interface ProjectCreationBody {
  name: string
  addr: string
  entries?: Record<string, any>
  type: AppType
}

export interface ProjectUpdateBody {
  name?: string
  url?: string
  entries?: Record<string, any>
  type?: AppType
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ActionQuery {
  type?: 'static_analysis' | 'report' | 'connection_auto_create'
  status?: 'pending' | 'running' | 'completed' | 'failed'
  limit?: number
  offset?: number
}
