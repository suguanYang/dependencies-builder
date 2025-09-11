import { NodeType } from "../generated/prisma";

// For dependency layer - only graph-related properties
export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
}

export interface GraphConnection {
  id: string;
  fromId: string;
  toId: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphConnection[];
}