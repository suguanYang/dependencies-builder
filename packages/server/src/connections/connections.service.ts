import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConnectionQueryDto } from './dto/connection-query.dto';
import { CreateConnectionDto } from './dto/create-connection.dto';

@Injectable()
export class ConnectionsService {
  constructor(private prisma: PrismaService) {}

  async getConnections(query: ConnectionQueryDto) {
    try {
      const { take, skip, ...filters } = query;

      // Build the where clause with node field filters
      const prismaWhere: any = {};

      // Add direct connection filters
      if (filters.fromId) prismaWhere.fromId = filters.fromId;
      if (filters.toId) prismaWhere.toId = filters.toId;

      // Build AND conditions for node field filters
      const andConditions: any[] = [];

      // From node filters
      if (filters.fromNodeName || filters.fromNodeProjectName || filters.fromNodeType) {
        const fromNodeCondition: any = {};
        if (filters.fromNodeName) fromNodeCondition.name = { contains: filters.fromNodeName };
        if (filters.fromNodeProjectName)
          fromNodeCondition.projectName = { contains: filters.fromNodeProjectName };
        if (filters.fromNodeType) {
          fromNodeCondition.type = { equals: filters.fromNodeType };
        }
        andConditions.push({ fromNode: fromNodeCondition });
      }

      // To node filters
      if (filters.toNodeName || filters.toNodeProjectName || filters.toNodeType) {
        const toNodeCondition: any = {};
        if (filters.toNodeName) toNodeCondition.name = { contains: filters.toNodeName };
        if (filters.toNodeProjectName)
          toNodeCondition.projectName = { contains: filters.toNodeProjectName };
        if (filters.toNodeType) {
          toNodeCondition.type = { equals: filters.toNodeType };
        }
        andConditions.push({ toNode: toNodeCondition });
      }

      // Add AND conditions if any exist
      if (andConditions.length > 0) {
        prismaWhere.AND = andConditions;
      }

      const [data, total] = await Promise.all([
        this.prisma.connection.findMany({
          where: prismaWhere,
          orderBy: { createdAt: 'desc' },
          take: take ?? 100,
          skip: skip ?? 0,
          include: {
            fromNode: true,
            toNode: true,
          },
        }),
        this.prisma.connection.count({ where: prismaWhere }),
      ]);

      return {
        data,
        total,
        limit: take ?? 100,
        offset: skip ?? 0,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createConnection(createConnectionDto: CreateConnectionDto) {
    try {
      const { fromId, toId } = createConnectionDto;

      // Check if both nodes exist
      const [fromNode, toNode] = await Promise.all([
        this.prisma.node.findUnique({ where: { id: fromId } }),
        this.prisma.node.findUnique({ where: { id: toId } }),
      ]);

      if (!fromNode || !toNode) {
        throw new Error('Both from and to nodes must exist');
      }

      const connection = await this.prisma.connection.create({
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
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to create connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteConnection(id: string) {
    try {
      const success = await this.prisma.connection.delete({
        where: { id },
      }).then(() => true).catch(() => false);

      if (!success) {
        throw new NotFoundException('No connections found for the specified id');
      }

      return { success: true, message: 'Connection deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to delete connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteConnectionsByFrom(fromId: string) {
    try {
      const success = await this.prisma.connection.deleteMany({
        where: { fromId },
      }).then(() => true).catch(() => false);

      if (!success) {
        throw new NotFoundException('No connections found for the specified from node');
      }

      return { success: true, message: 'Connections deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to delete connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}