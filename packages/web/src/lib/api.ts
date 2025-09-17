export interface Node {
  id: string
  name: string
  project: string
  type: number
  branch: string
  version?: string
  relativePath?: string
  startLine?: number
  startColumn?: number
  meta?: Record<string, any>
}

export interface Connection {
  id: string
  fromId: string
  toId: string
  createdAt?: string
}

export interface SearchFilters {
  project?: string
  branch?: string
  type?: string
  name?: string
  limit?: number
  offset?: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function searchNodes(filters: SearchFilters): Promise<Node[]> {
  const params = new URLSearchParams()
  
  if (filters.project) params.append('project', filters.project)
  if (filters.branch) params.append('branch', filters.branch)
  if (filters.type) params.append('type', filters.type)
  if (filters.name) params.append('name', filters.name)
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.offset) params.append('offset', filters.offset.toString())

  const response = await fetch(`${API_BASE}/nodes?${params}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch nodes: ${response.statusText}`)
  }

  return response.json()
}

export async function getConnections(nodeId: string): Promise<Connection[]> {
  const response = await fetch(`${API_BASE}/connections?fromId=${nodeId}&toId=${nodeId}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch connections: ${response.statusText}`)
  }

  return response.json()
}