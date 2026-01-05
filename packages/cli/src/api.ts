import { Connection } from './server-types'
import debug from './utils/debug'

const API_BASE = process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001'

const CLI_KEY = process.env.DMS_SERVER_CLI_KEY

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}/${endpoint}`

  const headers: Record<string, string> = {
    ...(!!options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
    'dms-key': CLI_KEY || 'null',
  }

  debug(`request to ${url}`)
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
      errorData.error ||
      errorData.message ||
      `HTTP ${response.status}: ${response.statusText}` + (errorData.details || ''),
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
      method: 'GET',
    })

    return project
  } catch (error) {
    throw error
  }
}

export const batchCreateNodes = async (bd: { shallowBranch: string; data: unknown[] }) => {
  const response = await apiRequest<{ message: string }>(`nodes/batch-create`, {
    method: 'POST',
    body: JSON.stringify(bd),
  })

  return response
}

export const commitCreatedNodes = async (bd: {
  shallowBranch: string
  projectNames: string[]
  targetBranch: string
}) => {
  const response = await apiRequest<{ message: string }>(`nodes/batch-create/commit`, {
    method: 'POST',
    body: JSON.stringify(bd),
  })

  return response
}

export const rollbackCreatedNodes = async (bd: {
  shallowBranch: string
  projectNames: string[]
}) => {
  const response = await apiRequest<{ message: string }>(`nodes/batch-create/rollback`, {
    method: 'POST',
    body: JSON.stringify(bd),
  })

  return response
}

export const getAnyNodeByProjectBranchVersion = async (
  projectName: string,
  branch: string,
  version: string,
) => {
  const res = await apiRequest<{
    data: {
      qlsVersion?: string
    }[]
  }>(`nodes?version=${version}&projectName=${projectName}&branch=${branch}&limit=1`, {
    method: 'GET',
  })

  if (!res.data) {
    throw new Error('can not parse nodes data')
  }

  return res.data?.[0]
}

export const updateAction = async (actionId: string, update: unknown) => {
  return apiRequest(`actions/${actionId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}

export const getConnectionsByToNode = async (node: {
  name: string
  projectName: string
  type: string
}) => {
  return apiRequest<{
    data: Connection[]
  }>(
    `connections?toNodeName=${node.name}&toNodeProjectName=${node.projectName}&toNodeType=${node.type}`,
    {
      method: 'GET',
    },
  ).then(res => res.data)
}