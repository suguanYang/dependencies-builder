import { prisma } from './prisma'
import { Prisma } from '../generated/prisma'

export async function getNodes(query: Prisma.NodeFindManyArgs, all?: boolean) {
  const { where, take, skip } = query

  const [data, total] = await Promise.all([
    prisma.node.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: all ? undefined : take ?? 100,
      skip: all ? undefined : skip ?? 0,
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
  node: Omit<Prisma.NodeCreateInput, 'id' | 'createdAt' | 'updatedAt'>,
) {
  // Check if node already exists based on unique constraints
  const existingNode = await prisma.node.findFirst({
    where: {
      project: node.project,
      branch: node.branch,
      type: node.type,
      name: node.name,
      relativePath: node.relativePath,
      startLine: node.startLine,
      startColumn: node.startColumn,
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
      take: take ?? 100,
      skip: skip ?? 0,
      include: {
        fromNode: true,
        toNode: true,
      },
    }),
    prisma.connection.count({ where }),
  ])

  return {
    data: data.map((connection) => ({
      id: connection.id,
      fromId: connection.fromId,
      toId: connection.toId,
      createdAt: connection.createdAt,
    })),
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
