export enum NodeType {
  NamedExport = 'NamedExport',
  NamedImport = 'NamedImport',
  RuntimeDynamicImport = 'RuntimeDynamicImport',
  GlobalVarRead = 'GlobalVarRead',
  GlobalVarWrite = 'GlobalVarWrite',
  WebStorageRead = 'WebStorageRead',
  WebStorageWrite = 'WebStorageWrite',
  EventOn = 'EventOn',
  EventEmit = 'EventEmit',
  DynamicModuleFederationReference = 'DynamicModuleFederationReference',
}

export interface Node {
  id: string
  name: string
  projectName: string
  type: NodeType
  branch: string
  version?: string
  relativePath?: string
  startLine?: number
  startColumn?: number
  endLine?: number
  endColumn?: number
  meta?: Record<string, any>
}

export interface Connection {
  id: string
  fromId: string
  toId: string
  createdAt?: string
  fromNode?: Node
  toNode?: Node
}

export interface SearchFilters {
  projectName?: string
  branch?: string
  type?: NodeType
  name?: string
  standalone?: boolean
  limit?: number
  offset?: number
}

const API_BASE = '/api'

export async function searchNodes(filters: SearchFilters): Promise<Node[]> {
  const params = new URLSearchParams()

  if (filters.projectName) params.append('projectName', filters.projectName)
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
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const headers: Record<string, string> = {
    ...(!!options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  }

  const response = await fetch(url, {
    headers,
    ...options,
  })

  if (!response.ok) {
    // Handle 401 Unauthorized by redirecting to login
    if (response.status === 401) {
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Authentication required')
    }

    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
    )
  }

  return response.json()
}

// Nodes API
export async function getNodes(filters?: SearchFilters): Promise<{ data: Node[]; total: number }> {
  const params = new URLSearchParams()

  if (filters?.projectName) params.append('projectName', filters.projectName)
  if (filters?.branch) params.append('branch', filters.branch)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.name) params.append('name', filters.name)
  if (filters?.standalone !== undefined) params.append('standalone', filters.standalone.toString())
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const queryString = params.toString()
  return apiRequest(`/nodes${queryString ? `?${queryString}` : ''}`)
}

export async function getNodeById(id: string): Promise<Node> {
  return apiRequest(`/nodes/${id}`)
}

export const getNode = getNodeById

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
  fromNodeName?: string
  toNodeName?: string
  fromNodeProjectName?: string
  toNodeProjectName?: string
  fromNodeType?: string
  toNodeType?: string
  limit?: number
  offset?: number
}): Promise<{ data: Connection[]; total: number }> {
  const params = new URLSearchParams()

  // Use partial matching for all text fields - backend will use Prisma's contains/startsWith
  if (filters?.fromId) params.append('fromId', filters.fromId)
  if (filters?.toId) params.append('toId', filters.toId)
  if (filters?.fromNodeName) params.append('fromNodeName', filters.fromNodeName)
  if (filters?.toNodeName) params.append('toNodeName', filters.toNodeName)
  if (filters?.fromNodeProjectName)
    params.append('fromNodeProjectName', filters.fromNodeProjectName)
  if (filters?.toNodeProjectName) params.append('toNodeProjectName', filters.toNodeProjectName)
  if (filters?.fromNodeType) params.append('fromNodeType', filters.fromNodeType)
  if (filters?.toNodeType) params.append('toNodeType', filters.toNodeType)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const queryString = params.toString()
  return apiRequest(`/connections${queryString ? `?${queryString}` : ''}`)
}

export async function createConnection(connectionData: {
  fromId: string
  toId: string
}): Promise<Connection> {
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
  type: 'static_analysis' | 'report' | 'connection_auto_create'
  parameters: {
    projectAddr?: string
    projectName?: string
    branch?: string
    targetBranch?: string
  }
  createdAt: string
  updatedAt: string
  result?: any
  error?: string
}

export interface CreateActionData {
  projectAddr?: string
  projectName?: string
  branch?: string
  type: 'static_analysis' | 'report' | 'connection_auto_create'
  targetBranch?: string
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

export async function streamActionLogs(
  actionId: string,
  onEvent: (event: string) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): Promise<void> {
  const url = `${API_BASE}/actions/${actionId}/stream`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to stream action logs: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            reader.cancel()
            onComplete?.()
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            try {
              onEvent(line)
            } catch (parseError) {
              console.warn('Failed to parse stream event:', parseError)
            }
          }
        }
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Stream error'))
      }
    }

    processStream()
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to connect to stream'))
  }
}

export async function stopActionExecution(
  actionId: string,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/actions/${actionId}/stop`, {
    method: 'POST',
  })
}

// Projects API
export enum AppType {
  Lib = 'Lib',
  App = 'App',
}

export interface ProjectEntry {
  name: string
  path: string
}

export interface Project {
  id: string
  name: string
  addr: string
  type: AppType
  entries?: ProjectEntry[]
  createdAt: string
  updatedAt: string
}

export interface ProjectQuery {
  name?: string
  addr?: string
  type?: AppType
  limit?: number
  offset?: number
}

export interface ProjectCreationData {
  name: string
  addr: string
  type: AppType
  entries?: ProjectEntry[]
}

export interface ProjectUpdateData {
  name?: string
  addr?: string
  type?: AppType
  entries?: ProjectEntry[]
}

export async function getProjects(
  filters?: ProjectQuery,
): Promise<{ data: Project[]; total: number }> {
  const params = new URLSearchParams()

  if (filters?.name) params.append('name', filters.name)
  if (filters?.addr) params.append('addr', filters.addr)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const queryString = params.toString()
  return apiRequest(`/projects${queryString ? `?${queryString}` : ''}`)
}

export async function getProjectById(id: string): Promise<Project> {
  return apiRequest(`/projects/${id}`)
}

export async function getProjectByName(name: string): Promise<Project> {
  return apiRequest(`/projects/name/${name}`)
}

export async function createProject(projectData: ProjectCreationData): Promise<Project> {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  })
}

export async function updateProject(id: string, projectData: ProjectUpdateData): Promise<Project> {
  return apiRequest(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(projectData),
  })
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/projects/${id}`, {
    method: 'DELETE',
  })
}

// Database Admin API
export interface DatabaseQueryRequest {
  query: string
}

export interface DatabaseQueryResult {
  success: boolean
  data?: any[]
  error?: string
  executionTime?: number
  rowCount?: number
}

export interface DatabaseTable {
  tableName: string
  sql: string
  rowCount: number
}

export interface DatabaseSchema {
  tables: DatabaseTable[]
}

export interface TableInfo {
  tableName: string
  schema: any[]
  sampleData: any[]
}

export async function executeDatabaseQuery(query: string): Promise<DatabaseQueryResult> {
  return apiRequest('/database-admin/query', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export async function getDatabaseSchema(): Promise<DatabaseSchema> {
  return apiRequest('/database-admin/schema')
}

export async function getTableInfo(tableName: string): Promise<TableInfo> {
  return apiRequest(`/database-admin/tables/${tableName}`)
}
