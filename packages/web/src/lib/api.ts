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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://172.20.169.243:3001'

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

// Base API request function with error handling
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
    )
  }

  return response.json()
}

// Nodes API
export async function getNodes(filters?: SearchFilters): Promise<{ data: Node[]; total: number }> {
  const params = new URLSearchParams()

  if (filters?.project) params.append('project', filters.project)
  if (filters?.branch) params.append('branch', filters.branch)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.name) params.append('name', filters.name)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const queryString = params.toString()
  return apiRequest(`/nodes${queryString ? `?${queryString}` : ''}`)
}

export async function getNodeById(id: string): Promise<Node> {
  return apiRequest(`/nodes/${id}`)
}

export async function getNodesByIds(ids: string[]): Promise<{ data: Node[] }> {
  return apiRequest('/nodes/batch', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function createNode(nodeData: Omit<Node, 'id' | 'createdAt'>): Promise<Node> {
  return apiRequest('/nodes', {
    method: 'POST',
    body: JSON.stringify(nodeData),
  })
}

export async function updateNode(id: string, nodeData: Partial<Omit<Node, 'id'>>): Promise<Node> {
  return apiRequest(`/nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(nodeData),
  })
}

export async function deleteNode(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/nodes/${id}`, {
    method: 'DELETE',
  })
}

// Connections API
export async function getConnectionsList(filters?: {
  fromId?: string
  toId?: string
  limit?: number
}): Promise<{ data: Connection[]; total: number }> {
  const params = new URLSearchParams()

  if (filters?.fromId) params.append('fromId', filters.fromId)
  if (filters?.toId) params.append('toId', filters.toId)
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const queryString = params.toString()
  return apiRequest(`/connections${queryString ? `?${queryString}` : ''}`)
}

export async function createConnection(connectionData: { fromId: string; toId: string }): Promise<Connection> {
  return apiRequest('/connections', {
    method: 'POST',
    body: JSON.stringify(connectionData),
  })
}

export async function deleteConnection(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/connections/${id}`, {
    method: 'DELETE',
  })
}

// Actions API
export interface Action {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  project?: string
  branch?: string
  type: string
  createdAt: string
  updatedAt: string
  result?: any
  error?: string
}

export interface CreateActionData {
  project: string
  branch: string
  type: 'static_analysis' | 'dependency_check' | 'validation'
}

export async function getActions(): Promise<{ data: Action[]; total: number }> {
  return apiRequest('/actions')
}

export async function getActionById(id: string): Promise<Action> {
  return apiRequest(`/actions/${id}`)
}

export async function createAction(actionData: CreateActionData): Promise<Action> {
  return apiRequest('/actions', {
    method: 'POST',
    body: JSON.stringify(actionData),
  })
}

export async function deleteAction(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/actions/${id}`, {
    method: 'DELETE',
  })
}

export async function getActionResult(id: string): Promise<any> {
  return apiRequest(`/actions/${id}/result`)
}