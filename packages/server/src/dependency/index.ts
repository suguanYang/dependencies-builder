import { Node, Edge, DependencyGraph } from './types';

export class DependencyManager {
  // Pure dependency graph algorithms and logic
  
  buildDependencyGraph(nodes: Node[], edges: Edge[]): DependencyGraph {
    return { nodes, edges };
  }

  findDependencies(nodeId: string, edges: Edge[]): string[] {
    return edges
      .filter(edge => edge.fromId === nodeId)
      .map(edge => edge.toId);
  }

  findDependents(nodeId: string, edges: Edge[]): string[] {
    return edges
      .filter(edge => edge.toId === nodeId)
      .map(edge => edge.fromId);
  }

  traverseDependencies(
    nodeId: string,
    edges: Edge[],
    visited: Set<string> = new Set()
  ): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const dependencies = this.findDependencies(nodeId, edges);
    const result: string[] = [nodeId];

    for (const depId of dependencies) {
      result.push(...this.traverseDependencies(depId, edges, visited));
    }

    return result;
  }

  traverseDependents(
    nodeId: string,
    edges: Edge[],
    visited: Set<string> = new Set()
  ): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const dependents = this.findDependents(nodeId, edges);
    const result: string[] = [nodeId];

    for (const depId of dependents) {
      result.push(...this.traverseDependents(depId, edges, visited));
    }

    return result;
  }

  getFullDependencyGraph(nodeId: string, nodes: Node[], edges: Edge[]): DependencyGraph {
    const visited = new Set<string>();
    const relevantNodes: Node[] = [];
    const relevantEdges: Edge[] = [];

    // Traverse both dependencies and dependents
    const allNodeIds = [
      ...this.traverseDependencies(nodeId, edges),
      ...this.traverseDependents(nodeId, edges)
    ];

    // Remove duplicates
    const uniqueNodeIds = Array.from(new Set(allNodeIds));

    // Collect relevant nodes
    for (const id of uniqueNodeIds) {
      const node = nodes.find(n => n.id === id);
      if (node) {
        relevantNodes.push(node);
      }
    }

    // Collect relevant edges
    for (const edge of edges) {
      if (uniqueNodeIds.includes(edge.fromId) && uniqueNodeIds.includes(edge.toId)) {
        relevantEdges.push(edge);
      }
    }

    return {
      nodes: relevantNodes,
      edges: relevantEdges
    };
  }

  validateEdgeCreation(fromNode: Node, toNode: Node): boolean {
    // Basic validation rules
    if (!fromNode || !toNode) return false;
    
    // Cannot create circular dependencies
    if (fromNode.id === toNode.id) return false;
    
    // Additional validation logic can be added here
    return true;
  }

  findCircularDependencies(edges: Edge[]): string[][] {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    for (const edge of edges) {
      if (!graph.has(edge.fromId)) {
        graph.set(edge.fromId, []);
      }
      graph.get(edge.fromId)!.push(edge.toId);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[] = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(nodeId);
      path.pop();
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }
}