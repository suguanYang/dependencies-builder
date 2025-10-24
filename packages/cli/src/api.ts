const API_BASE = process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001'

const CLI_KEY = process.env.DMS_SERVER_CLI_KEY

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}/${endpoint}`

  const headers: Record<string, string> = {
    ...(!!options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
    "cli-key": CLI_KEY || 'null'
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required')
    }

    const errorData: any = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
    )
  }

  return response.json() as any
}

export const getProjectByName = async (name: string) => {
  try {
    const project = await apiRequest<{
      entries: { name: string; path: string }[]
      type: 'Lib' | 'App'
    }>(`projects/name/${encodeURIComponent(name)}`, {
      method: 'GET'
    })

    return project
  } catch (error) {
    throw error
  }
}

export const batchCreateNodes = async (nodes: any[]) => {
  const response = await apiRequest<{ message: string }>(`nodes/batch-create`, {
    method: 'POST',
    body: JSON.stringify(nodes),
  })

  return response
}