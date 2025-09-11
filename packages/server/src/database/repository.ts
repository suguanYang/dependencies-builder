import { prisma } from './prisma';
import { Prisma } from '../generated/prisma';

export class NodeRepository {
  async getNodes(query: Prisma.NodeFindManyArgs) {
    const { where, take, skip } = query;

    const [data, total] = await Promise.all([
      prisma.node.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take || 100,
        skip: skip || 0,
      }),
      prisma.node.count({ where }),
    ]);

    return {
      data: data,
      total,
    };
  }

  async getNodeById(id: string) {
    const node = await prisma.node.findUnique({
      where: { id },
    });
    return node;
  }

  async createNode(node: Omit<Prisma.NodeCreateInput, 'id' | 'createdAt' | 'updatedAt'>) {
    const createdNode = await prisma.node.create({
      data: node,
    });
    return createdNode;
  }

  async updateNode(id: string, updates: Omit<Prisma.NodeUpdateInput, 'id' | 'createdAt' | 'updatedAt'>) {
    const updatedNode = await prisma.node.update({
      where: { id },
      data: updates,
    });
    return updatedNode;
  }

  async deleteNode(id: string) {
    try {
      await prisma.node.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export class ConnectionRepository {
  async getConnections(query: Prisma.ConnectionFindManyArgs) {
    const { take, skip, where } = query;

    const [data, total] = await Promise.all([
      prisma.connection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take || 100,
        skip: skip || 0,
        include: {
          fromNode: true,
          toNode: true,
        },
      }),
      prisma.connection.count({ where }),
    ]);

    return {
      data: data.map(connection => ({
        id: connection.id,
        fromId: connection.fromId,
        toId: connection.toId,
        createdAt: connection.createdAt,
      })),
      total,
    };
  }

  async createConnection(fromId: string, toId: string) {
    // Check if both nodes exist
    const [fromNode, toNode] = await Promise.all([
      prisma.node.findUnique({ where: { id: fromId } }),
      prisma.node.findUnique({ where: { id: toId } }),
    ]);

    if (!fromNode || !toNode) {
      throw new Error('Both from and to nodes must exist');
    }

    const connection = await prisma.connection.create({
      data: {
        fromId,
        toId,
      },
    });

    return {
      id: connection.id,
      fromId: connection.fromId,
      toId: connection.toId,
      createdAt: connection.createdAt,
    };
  }

  async deleteConnection(id: string) {
    try {
      await prisma.connection.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteConnectionsByFrom(fromId: string) {
    try {
      await prisma.connection.deleteMany({
        where: { fromId },
      });
      return true;
    } catch {
      return false;
    }
  }
}