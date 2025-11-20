import { DependencyGraph, D3Node, D3Link } from '../types';

/**
 * Parse server-side dependency graph format into D3-compatible format
 */
export function parseDependencyGraph(graph: DependencyGraph): { nodes: D3Node[]; links: D3Link[] } {
  const nodes: D3Node[] = [];
  const links: D3Link[] = [];

  // Create node lookup map
  const nodeMap = new Map<string, D3Node>();

  // Parse vertices into D3 nodes
  graph.vertices.forEach(vertex => {
    const node: D3Node = {
      ...vertex.data
    };
    nodes.push(node);
    nodeMap.set(vertex.data.id, node);
  });

  // Parse edges into D3 links
  graph.edges.forEach(edge => {
    const sourceNode = nodeMap.get(edge.data.fromId);
    const targetNode = nodeMap.get(edge.data.toId);

    if (sourceNode && targetNode) {
      const link: D3Link = {
        source: sourceNode,
        target: targetNode,
        id: edge.data.id,
      };
      links.push(link);
    }
  });

  return { nodes, links };
}

/**
 * Generate a mock dependency graph for testing
 */
export function generateMockDependencyGraph(): DependencyGraph {
  return {
    vertices: [
      {
        data: {
          id: 'node-1',
          name: 'UserService',
          type: 'SERVICE' as any,
          projectName: 'backend',
          projectId: 'proj-1',
          branch: 'main',
        },
        firstIn: 0,
        firstOut: 0,
      },
      {
        data: {
          id: 'node-2',
          name: 'AuthService',
          type: 'SERVICE' as any,
          projectName: 'backend',
          projectId: 'proj-1',
          branch: 'main',
        },
        firstIn: 1,
        firstOut: 1,
      },
      {
        data: {
          id: 'node-3',
          name: 'UserDatabase',
          type: 'DATABASE' as any,
          projectName: 'backend',
          projectId: 'proj-1',
          branch: 'main',
        },
        firstIn: 2,
        firstOut: 2,
      },
    ],
    edges: [
      {
        data: {
          id: 'conn-1',
          fromId: 'node-1',
          toId: 'node-2',
        },
        tailvertex: 0,
        headvertex: 1,
        headnext: 0,
        tailnext: 0,
      },
      {
        data: {
          id: 'conn-2',
          fromId: 'node-1',
          toId: 'node-3',
        },
        tailvertex: 0,
        headvertex: 2,
        headnext: 1,
        tailnext: 1,
      },
    ],
  };
}