import { prisma } from './prisma'
import { Prisma } from '../generated/prisma/client'
import { ConnectionQuery } from '../api/types'

// Valid NodeType values from Prisma schema
const VALID_NODE_TYPES = [
  'NamedExport',
  'NamedImport',
  'RuntimeDynamicImport',
  'GlobalVarRead',
  'GlobalVarWrite',
  'WebStorageRead',
  'WebStorageWrite',
  'EventOn',
  'EventEmit',
  'DynamicModuleFederationReference',
] as const

function isValidNodeType(type: string): boolean {
  return VALID_NODE_TYPES.includes(type as any)
}

export async function getNodes(query: Prisma.NodeFindManyArgs & { where?: any }, all?: boolean) {
  const { where, take, skip } = query

  // Handle standalone filter - nodes that don't have any connections
  let finalWhere = where
  if (where?.standalone !== undefined) {
    const { standalone, ...otherWhere } = where

    // Convert string "true" to boolean true
    const standaloneBool = standalone === true || standalone === 'true'

    if (standaloneBool === true) {
      // Find nodes that don't have any connections (neither fromConnections nor toConnections)
      finalWhere = {
        ...otherWhere,
        AND: [
          ...(otherWhere.AND || []),
          {
            fromConnections: { none: {} },
            toConnections: { none: {} },
          },
        ],
      }
    } else if (standaloneBool === false) {
      // Find nodes that have at least one connection
      finalWhere = {
        ...otherWhere,
        OR: [
          ...(otherWhere.OR || []),
          { fromConnections: { some: {} } },
          { toConnections: { some: {} } },
        ],
      }
    }
  }

  const [data, total] = await Promise.all([
    prisma.node.findMany({
      where: finalWhere,
      orderBy: { updatedAt: 'desc' },
      take: all ? undefined : (take ?? 100),
      skip: all ? undefined : (skip ?? 0),
    }),
    prisma.node.count({ where: finalWhere }),
  ])

  return {
    data: data,
    total,
  }
}

export async function getNodeById(id: string) {
  const node = await prisma.node.findUnique({
    where: { id },
  })
  return node
}

export async function getNodesByIds(ids: string[]) {
  if (ids.length === 0) {
    return []
  }

  const nodes = await prisma.node.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  })

  return nodes
}

export async function createNode(
  node: Omit<Prisma.NodeUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>,
) {
  // Check if node already exists based on unique constraints
  const existingNode = await prisma.node.findFirst({
    where: {
      projectName: node.projectName,
      branch: node.branch,
      type: node.type,
      name: node.name,
      relativePath: node.relativePath,
      startLine: node.startLine,
      startColumn: node.startColumn,
      endLine: node.endLine,
      endColumn: node.endColumn,
    },
  })

  if (existingNode) {
    // Update existing node instead of creating new one
    const updatedNode = await prisma.node.update({
      where: { id: existingNode.id },
      data: {
        version: node.version,
        meta: node.meta,
        updatedAt: new Date(),
      },
    })
    return updatedNode
  }

  // Create new node if it doesn't exist
  const createdNode = await prisma.node.create({
    data: node,
  })
  return createdNode
}

export async function updateNode(
  id: string,
  updates: Omit<Prisma.NodeUpdateInput, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const updatedNode = await prisma.node.update({
    where: { id },
    data: updates,
  })
  return updatedNode
}

export async function createSequenceNodes(
  nodes: Omit<Prisma.NodeUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>[]
) {
  const node = nodes[0]
  const [_, createdNodes] = await prisma.$transaction([
    prisma.node.deleteMany({
      where: {
        branch: node.branch,
        projectName: node.projectName,
        version: {
          not: node.version,
        },
        NOT: {
          version: ''
        }
      },
    }),
    prisma.node.createMany({
      data: nodes,
    }),
  ])
  return createdNodes
}

export async function deleteNode(id: string) {
  try {
    await prisma.node.delete({
      where: { id },
    })
    return true
  } catch {
    return false
  }
}

export async function getConnections(query: ConnectionQuery & { take?: number; skip?: number }) {
  const { take, skip, ...filters } = query

  // Build the where clause with node field filters
  const prismaWhere: Prisma.ConnectionWhereInput = {}

  // Add direct connection filters
  if (filters.fromId) prismaWhere.fromId = filters.fromId
  if (filters.toId) prismaWhere.toId = filters.toId

  // Build AND conditions for node field filters
  const andConditions: Prisma.ConnectionWhereInput[] = []

  // From node filters
  if (filters.fromNodeName || filters.fromNodeProjectName || filters.fromNodeType) {
    const fromNodeCondition: Prisma.NodeWhereInput = {}
    if (filters.fromNodeName) fromNodeCondition.name = { contains: filters.fromNodeName }
    if (filters.fromNodeProjectName)
      fromNodeCondition.projectName = { contains: filters.fromNodeProjectName }
    if (filters.fromNodeType && isValidNodeType(filters.fromNodeType)) {
      fromNodeCondition.type = { equals: filters.fromNodeType as any }
    }
    andConditions.push({ fromNode: fromNodeCondition })
  }

  // To node filters
  if (filters.toNodeName || filters.toNodeProjectName || filters.toNodeType) {
    const toNodeCondition: Prisma.NodeWhereInput = {}
    if (filters.toNodeName) toNodeCondition.name = { contains: filters.toNodeName }
    if (filters.toNodeProjectName)
      toNodeCondition.projectName = { contains: filters.toNodeProjectName }
    if (filters.toNodeType && isValidNodeType(filters.toNodeType)) {
      toNodeCondition.type = { equals: filters.toNodeType as any }
    }
    andConditions.push({ toNode: toNodeCondition })
  }

  // Add AND conditions if any exist
  if (andConditions.length > 0) {
    prismaWhere.AND = andConditions
  }

  const [data, total] = await Promise.all([
    prisma.connection.findMany({
      where: prismaWhere,
      orderBy: { createdAt: 'desc' },
      take: take ?? 100,
      skip: skip ?? 0,
      include: {
        fromNode: true,
        toNode: true,
      },
    }),
    prisma.connection.count({ where: prismaWhere }),
  ])

  return {
    data,
    total,
  }
}

export async function createConnection(fromId: string, toId: string) {
  // Check if both nodes exist
  const [fromNode, toNode] = await Promise.all([
    prisma.node.findUnique({ where: { id: fromId } }),
    prisma.node.findUnique({ where: { id: toId } }),
  ])

  if (!fromNode || !toNode) {
    throw new Error('Both from and to nodes must exist')
  }

  const connection = await prisma.connection.create({
    data: {
      fromId,
      toId,
    },
  })

  return {
    id: connection.id,
    fromId: connection.fromId,
    toId: connection.toId,
    createdAt: connection.createdAt,
  }
}

export async function deleteConnection(id: string) {
  try {
    await prisma.connection.delete({
      where: { id },
    })
    return true
  } catch {
    return false
  }
}

export async function deleteConnectionsByFrom(fromId: string) {
  try {
    await prisma.connection.deleteMany({
      where: { fromId },
    })
    return true
  } catch {
    return false
  }
}

// Project repository functions
export async function getProjects(query: Prisma.ProjectFindManyArgs & { where?: any }) {
  const { where, take, skip } = query

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: take ?? 100,
      skip: skip ?? 0,
    }),
    prisma.project.count({ where }),
  ])

  return {
    data,
    total,
  }
}

export async function getProjectById(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
  })
  return project
}

export async function getProjectByName(name: string) {
  const project = await prisma.project.findUnique({
    where: { name },
  })
  return project
}

export async function createProject(
  project: Omit<Prisma.ProjectCreateInput, 'id' | 'createdAt' | 'updatedAt'>,
) {
  // Check if project already exists with the same name
  const existingProject = await prisma.project.findUnique({
    where: { name: project.name },
  })

  if (existingProject) {
    throw new Error(`Project with name '${project.name}' already exists`)
  }

  const createdProject = await prisma.project.create({
    data: project,
  })
  return createdProject
}

export async function updateProject(
  id: string,
  updates: Omit<Prisma.ProjectUpdateInput, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const updatedProject = await prisma.project.update({
    where: { id },
    data: updates,
  })
  return updatedProject
}

export async function deleteProject(id: string) {
  try {
    await prisma.project.delete({
      where: { id },
    })
    return true
  } catch {
    return false
  }
}

export interface CreateActionData {
  projectAddr?: string
  projectName?: string
  branch?: string
  type: 'static_analysis' | 'report' | 'connection_auto_create'
  targetBranch?: string
  ignoreCallGraph?: boolean
}

export interface UpdateActionData {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface ActionQuery {
  type?: 'static_analysis' | 'report' | 'connection_auto_create'
  status?: 'pending' | 'running' | 'completed' | 'failed'
  limit?: number
  offset?: number
}

export async function getActions(query: ActionQuery = {}) {
  const { limit = 100, offset = 0, ...where } = query

  const [data, total] = await Promise.all([
    prisma.action.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.action.count({
      where,
    }),
  ])

  return { data, total }
}

export async function getActionById(id: string) {
  return prisma.action.findUnique({
    where: { id },
  })
}

export async function createAction(actionData: CreateActionData) {
  const parameters: Record<string, any> = {}

  // Only include project and branch if they exist (for connection_auto_create they won't)
  if (actionData.branch) parameters.branch = actionData.branch
  if (actionData.targetBranch) parameters.targetBranch = actionData.targetBranch
  if (actionData.projectName) parameters.projectName = actionData.projectName
  if (actionData.projectAddr) parameters.projectAddr = actionData.projectAddr
  if (actionData.ignoreCallGraph !== undefined)
    parameters.ignoreCallGraph = actionData.ignoreCallGraph

  return prisma.action.create({
    data: {
      status: 'pending',
      type: actionData.type,
      parameters,
    },
  })
}

export async function updateAction(id: string, updates: UpdateActionData) {
  return prisma.action.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
  })
}

export async function deleteAction(id: string) {
  try {
    await prisma.action.delete({
      where: { id },
    })
    return true
  } catch (error) {
    return false
  }
}

export async function countRunningActions(): Promise<number> {
  return prisma.action.count({
    where: { status: 'running' },
  })
}
