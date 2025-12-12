// Manually defined types to match Prisma schema
// This avoids dependency on @prisma/client which might not have these types generated in this context

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
  UrlParamRead = 'UrlParamRead',
  UrlParamWrite = 'UrlParamWrite',
}

export enum AppType {
  Lib = 'Lib',
  App = 'App',
}

export enum ActionType {
  static_analysis = 'static_analysis',
  report = 'report',
}

export enum ActionStatus {
  pending = 'pending',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
}

export interface Node {
  id: string
  branch: string
  projectId: string
  projectName: string
  version: string
  type: NodeType
  name: string
  relativePath: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  meta: any
  createdAt: string
  updatedAt: string
  qlsVersion: string
  project?: Project
  import_pkg?: string | null
  import_name?: string | null
  import_subpkg?: string | null
  export_entry?: string | null
}

export interface Project {
  id: string
  addr: string
  name: string
  type: AppType
  entries: any | null
  createdAt: string
  updatedAt: string
}

export interface Connection {
  id: string
  fromId: string
  toId: string
  createdAt: string
  fromNode: Node
  toNode: Node
}

export interface Action {
  id: string
  status: ActionStatus
  type: ActionType
  parameters: {
    projectAddr?: string
    projectName?: string
    branch?: string
    targetBranch?: string
    ignoreCallGraph?: boolean
  }
  result: any | null
  error: string | null
  logs: any | null
  createdAt: string
  updatedAt: string
}

// Placeholder for other types if needed, or remove if unused
export interface User {
  id: string
}
export interface Session {
  id: string
}
export interface Account {
  id: string
}
export interface Verification {
  id: string
}
export interface Apikey {
  id: string
}
