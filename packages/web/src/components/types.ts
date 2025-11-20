import { NodeType, AppType } from "@/lib/api";


// Unified type for all entities (nodes and projects)
export type EntityType = NodeType | AppType;

// D3-compatible node interface
export interface D3Node {
  id: string;
  name: string;
  type: EntityType;
  projectName?: string;
  projectId?: string;
  branch: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  // Project-specific fields
  addr?: string;
  createdAt?: string;
  updatedAt?: string;
  // Node-specific fields
  relativePath?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  meta?: Record<string, any>;
}

// D3-compatible link interface
export interface D3Link {
  source: D3Node | string;
  target: D3Node | string;
  id?: string;
}

// Server-side dependency graph structure
export interface DependencyGraph {
  vertices: {
    data: {
      id: string;
      name: string;
      type: EntityType;
      projectName: string;
      projectId: string;
      branch: string;
      addr?: string;

    };
    firstIn: number;
    firstOut: number;
  }[];
  edges: {
    data: {
      id: string;
      fromId: string;
      toId: string;
    };
    tailvertex: number;
    headvertex: number;
    headnext: number;
    tailnext: number;
  }[];
}