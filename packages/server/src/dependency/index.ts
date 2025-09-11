import { GraphNode, GraphConnection, DependencyGraph } from './types';

export class DependencyManager {

  getFullDependencyGraph(nodeId: string, nodes: GraphNode[], connections: GraphConnection[]): DependencyGraph {
    throw new Error('Not implemented');
  }

  validateEdgeCreation(fromNode: GraphNode, toNode: GraphNode): boolean {
    throw new Error('Not implemented');
  }

  findCircularDependencies(connections: GraphConnection[]): string[][] {
    throw new Error('Not implemented');
  }

}