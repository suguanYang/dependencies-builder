import { GraphNode, GraphConnection, DependencyGraph } from './types'
import { buildDependencyGraph } from './graph'
import * as repository from '../database/repository'
import { Project } from '../generated/prisma/client'

// Custom error class for not found errors
class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export const validateEdgeCreation = (fromNode: GraphNode, toNode: GraphNode): boolean => {
  // Basic validation: ensure nodes are of compatible types
  const validTypePairs: Record<string, string[]> = {
    NamedImport: ['NamedExport'],
    RuntimeDynamicImport: ['NamedExport'],
    EventOn: ['EventEmit'],
    DynamicModuleFederationReference: ['NamedExport'],
  }

  const allowedTargets = validTypePairs[fromNode.type]
  return allowedTargets ? allowedTargets.includes(toNode.type) : false
}

export const getNodeDependencyGraph = async (
  nodeId: string,
  opts?: { depth?: number }
): Promise<DependencyGraph> => {
  const maxDepth = opts?.depth ?? 100;

  // State tracking
  const visitedNodeIds = new Set<string>([nodeId])
  const nodesMap = new Map<string, GraphNode>()
  const connectionsMap = new Map<string, GraphConnection>()

  // 1. Fetch the root node first
  const rootNode = await repository.getNodeById(nodeId)
  if (!rootNode) {
    // Depending on requirements, return empty graph or throw
    return buildDependencyGraph([], [])
  }
  nodesMap.set(nodeId, rootNode)

  // 2. BFS Layer Management
  let currentLevelNodeIds: string[] = [nodeId]
  let currentDepth = 0

  while (currentLevelNodeIds.length > 0 && currentDepth < maxDepth) {

    // A. Batch fetch ALL connections for the current layer
    // This replaces N queries with 1 query
    const connectionsResult = await repository.getConnections({
      where: {
        OR: [
          { fromId: { in: currentLevelNodeIds } },
          { toId: { in: currentLevelNodeIds } }
        ]
      }
    })

    const nextLevelNodeIds: string[] = []
    const newIdsToFetch = new Set<string>()

    // B. Process connections in memory
    for (const conn of connectionsResult.data) {
      // Create connection object
      const connectionId = conn.id // or custom ID logic if needed

      if (!connectionsMap.has(connectionId)) {
        connectionsMap.set(connectionId, {
          id: conn.id,
          fromId: conn.fromId,
          toId: conn.toId,
        })
      }

      // Determine if we found a new neighbor
      // We look for the ID that is NOT in our previously visited set
      let neighborId: string | null = null

      if (visitedNodeIds.has(conn.fromId) && !visitedNodeIds.has(conn.toId)) {
        neighborId = conn.toId
      } else if (visitedNodeIds.has(conn.toId) && !visitedNodeIds.has(conn.fromId)) {
        neighborId = conn.fromId
      }

      // If we found a valid unvisited neighbor, queue it
      if (neighborId) {
        visitedNodeIds.add(neighborId)
        newIdsToFetch.add(neighborId)
        nextLevelNodeIds.push(neighborId)
      }
    }

    // C. Batch fetch details for all new nodes found in this layer
    if (newIdsToFetch.size > 0) {
      const newNodes = await repository.getNodes({
        where: {
          id: { in: Array.from(newIdsToFetch) }
        }
      })

      newNodes.data.forEach(node => {
        nodesMap.set(node.id, node)
      })
    }

    // Prepare for next iteration
    currentLevelNodeIds = nextLevelNodeIds
    currentDepth++
  }

  // Build final graph
  return buildDependencyGraph(
    Array.from(nodesMap.values()),
    Array.from(connectionsMap.values())
  )
}

export const getProjectLevelDependencyGraph = async (
  projectId: string,
  branch: string,
  opts?: { depth?: number }
): Promise<DependencyGraph> => {
  const maxDepth = opts?.depth ?? 100;

  // Initialize state
  const visitedProjectIds = new Set<string>([projectId]);
  const projectInfos = new Map<string, { branch: string } & Project>();
  const projectConnections = new Map<string, GraphConnection>();

  // Get Root Project
  const rootProject = await repository.getProjectById(projectId);
  if (!rootProject) throw new NotFoundError(`Project ${projectId} not found`);

  projectInfos.set(projectId, { ...rootProject, branch });

  // Current Level Queue
  let currentLevelProjectIds: string[] = [projectId];
  let currentDepth = 0;

  while (currentLevelProjectIds.length > 0 && currentDepth < maxDepth) {
    // Optimization: Parallelize fetching data for ALL projects at this level
    // Note: Using nested selects avoids fetching 10,000 node IDs into memory
    const crossProjectConnectionsResult = await repository.getConnections({
      where: {
        OR: [
          { fromNode: { projectId: { in: currentLevelProjectIds }, branch } },
          { toNode: { projectId: { in: currentLevelProjectIds }, branch } }
        ]
      },
      select: {
        fromNode: { select: { projectId: true } },
        toNode: { select: { projectId: true } }
      }
    });

    const nextLevelProjectIds = new Set<string>();
    const newProjectIdsToFetch = new Set<string>();

    for (const conn of crossProjectConnectionsResult.data) {
      const sourcePid = conn.fromNode.projectId;
      const targetPid = conn.toNode.projectId;

      if (sourcePid === targetPid) {
        throw new Error('exising inner project connection! ' + conn.id)
      }

      const connectionId = `${sourcePid}-${targetPid}`;
      if (!projectConnections.has(connectionId)) {
        projectConnections.set(connectionId, {
          id: connectionId,
          fromId: sourcePid,
          toId: targetPid,
        });

        // Identify which side is the "new" discovery
        if (!visitedProjectIds.has(sourcePid)) {
          nextLevelProjectIds.add(sourcePid);
          newProjectIdsToFetch.add(sourcePid);
          visitedProjectIds.add(sourcePid);
        }
        if (!visitedProjectIds.has(targetPid)) {
          nextLevelProjectIds.add(targetPid);
          newProjectIdsToFetch.add(targetPid);
          visitedProjectIds.add(targetPid);
        }
      }
    }

    // Batch fetch project details for the newly discovered IDs
    if (newProjectIdsToFetch.size > 0) {
      const projects = await repository.getProjects({
        where: { id: { in: Array.from(newProjectIdsToFetch) } }
      });

      projects.data.forEach(p => {
        projectInfos.set(p.id, { ...p, branch });
      });
    }

    // Move to next level
    currentLevelProjectIds = Array.from(nextLevelProjectIds);
    currentDepth++;
  }

  // Assemble nodes
  const projectLevelNodes: GraphNode[] = Array.from(projectInfos.values());

  return buildDependencyGraph(projectLevelNodes, Array.from(projectConnections.values()));
};
