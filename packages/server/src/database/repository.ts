import { prisma } from './prisma'
import { ActionType, Prisma } from '../generated/prisma/client'
import { randomUUID } from 'node:crypto'

export async function getNodes(query: Prisma.NodeFindManyArgs) {
  const { where, take, skip } = query

  const [data, total] = await Promise.all([
    prisma.node.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: {
        project: {
          select: {
            addr: true,
          },
        },
      },
    }),
    prisma.node.count({ where }),
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

export async function createBatchNodes(
  nodes: Omit<Prisma.NodeUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>[],
) {
  const createdNodes = await prisma.node.createMany({
    data: nodes,
  })
  return createdNodes
}

export async function commitShallowNodes(
  shallowBranch: string,
  targetBranch: string,
  projectNames: string[],
) {
  return await prisma.$transaction(async (tx) => {
    const count = await tx.node.count({
      where: { branch: shallowBranch },
    })

    if (count === 0) {
      throw new Error('No staged nodes found to commit.')
    }

    await tx.node.deleteMany({
      where: {
        branch: targetBranch,
        projectName: { in: projectNames },
      },
    })

    await tx.node.updateMany({
      where: {
        branch: shallowBranch,
        projectName: { in: projectNames },
      },
      data: {
        branch: targetBranch,
      },
    })

    return { committedNodes: count }
  })
}

export async function rollbackBatch(shallowBranch: string) {
  await prisma.node.deleteMany({
    where: {
      branch: shallowBranch,
    },
  })

  return { success: true }
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

export async function getConnections(query: Prisma.ConnectionFindManyArgs) {
  const { take, skip, where } = query

  const [data, total] = await Promise.all([
    prisma.connection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        fromNode: {
          include: {
            project: true,
          },
        },
        toNode: {
          include: {
            project: true,
          },
        },
      },
    }),
    prisma.connection.count({ where }),
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
    fromId: connection.fromId,
    toId: connection.toId,
    createdAt: connection.createdAt,
  }
}

export async function deleteConnection(fromId: string, toId: string) {
  try {
    await prisma.connection.delete({
      where: {
        fromId_toId: {
          fromId,
          toId,
        },
      },
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
export async function getProjects(query: Prisma.ProjectFindManyArgs) {
  const { where, take, skip } = query

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
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
  type: ActionType
  targetBranch?: string
  ignoreCallGraph?: boolean
  scheduledFor?: Date
  status?: 'pending' | 'running' | 'completed' | 'failed'
}

export interface UpdateActionData {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  scheduledFor?: Date
}

export async function getActions(query: Prisma.ActionFindManyArgs) {
  const { take, skip, where } = query

  const [data, total] = await Promise.all([
    prisma.action.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
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

  // Only include project and branch if they exist
  if (actionData.branch) parameters.branch = actionData.branch
  if (actionData.targetBranch) parameters.targetBranch = actionData.targetBranch
  if (actionData.projectName) parameters.projectName = actionData.projectName
  if (actionData.projectAddr) parameters.projectAddr = actionData.projectAddr
  if (actionData.ignoreCallGraph !== undefined)
    parameters.ignoreCallGraph = actionData.ignoreCallGraph

  return prisma.action.create({
    data: {
      status: actionData.status ?? 'pending',
      type: actionData.type,
      parameters,
      scheduledFor: actionData.scheduledFor,
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

export async function findActiveActionByType(type: ActionType) {
  return prisma.action.findFirst({
    where: {
      type,
      status: {
        in: ['pending', 'running'],
      },
    },
  })
}

export async function claimNextAvailableAction(type: ActionType) {
  const now = new Date()

  const candidate = await prisma.action.findFirst({
    where: {
      status: 'pending',
      scheduledFor: {
        lte: now,
      },
      type,
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  if (!candidate) return null

  return claimAction(candidate.id)
}

export async function claimAction(id: string) {
  const { count } = await prisma.action.updateMany({
    where: {
      id,
      status: 'pending',
    },
    data: {
      status: 'running',
      updatedAt: new Date(),
      scheduledFor: new Date(),
    },
  })

  if (count === 0) {
    return null
  }

  return prisma.action.findUnique({ where: { id } })
}

export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  try {
    // 1. Try to create the lock
    await prisma.lock.create({
      data: {
        key,
        token,
        expiresAt,
      },
    })
    return token
  } catch (error) {
    // 2. If creation failed, check if existing lock is expired
    // We can try to delete it if it's expired
    const deleteResult = await prisma.lock.deleteMany({
      where: {
        key,
        expiresAt: {
          lt: now,
        },
      },
    })

    if (deleteResult.count > 0) {
      // 3. If we deleted an expired lock, try to create again
      try {
        await prisma.lock.create({
          data: {
            key,
            token,
            expiresAt,
          },
        })
        return token
      } catch {
        return null // Lost race condition
      }
    }

    return null
  }
}

export async function releaseLock(key: string, token: string): Promise<boolean> {
  // Only delete if the KEY matches AND the TOKEN matches
  const result = await prisma.lock.deleteMany({
    where: {
      key: key,
      token: token,
    },
  })
  return result.count > 0
}
