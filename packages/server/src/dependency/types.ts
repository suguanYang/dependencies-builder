export enum NodeType {
  NamedExport = 0,
  NamedImport = 1,
  RuntimeDynamicImport = 2,
  Externals = 3,
  GlobalState = 4,
  EventOn = 5,
  EventEmit = 6,
  DynamicModuleFederationReference = 7
}

export interface NodeMeta {
  [key: string]: any;
}

export interface Node {
  id: string;
  branch: string;
  project: string;
  version?: string;
  type: NodeType;
  name: string;
  relativePath?: string;
  startLine?: number;
  startColumn?: number;
  meta?: NodeMeta;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Edge {
  id: string;
  fromId: string;
  toId: string;
  createdAt?: Date;
}

export interface NodeQuery {
  project?: string;
  branch?: string;
  type?: NodeType;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface EdgeQuery {
  fromId?: string;
  toId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DependencyGraph {
  nodes: Node[];
  edges: Edge[];
}