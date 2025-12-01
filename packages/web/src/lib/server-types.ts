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
    UrlParamWrite = 'UrlParamWrite'
}

export enum AppType {
    Lib = 'Lib',
    App = 'App'
}

export enum ActionType {
    static_analysis = 'static_analysis',
    report = 'report',
    connection_auto_create = 'connection_auto_create'
}

export enum ActionStatus {
    pending = 'pending',
    running = 'running',
    completed = 'completed',
    failed = 'failed'
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
    createdAt: Date
    updatedAt: Date
    qlsVersion: string
}

export interface Project {
    id: string
    addr: string
    name: string
    type: AppType
    entries: any | null
    createdAt: Date
    updatedAt: Date
}

export interface Connection {
    id: string
    fromId: string
    toId: string
    createdAt: Date
}

export interface Action {
    id: string
    status: ActionStatus
    type: ActionType
    parameters: any
    result: any | null
    error: string | null
    logs: any | null
    createdAt: Date
    updatedAt: Date
}

// Placeholder for other types if needed, or remove if unused
export interface User { id: string }
export interface Session { id: string }
export interface Account { id: string }
export interface Verification { id: string }
export interface Apikey { id: string }
