import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as dependencyManager from '../dependency';

@Injectable()
export class DependenciesService {
  constructor(private prisma: PrismaService) {}

  async getDependencyGraph(nodeId?: string) {
    const [nodes, connections] = await Promise.all([
      this.prisma.node.findMany(),
      this.prisma.connection.findMany(),
    ]);

    const graph = dependencyManager.getFullDependencyGraph(nodes, connections);
    return graph;
  }

  async getProjectDependencyGraph(projectName: string, branch: string) {
    const [nodes, connections] = await Promise.all([
      this.prisma.node.findMany(),
      this.prisma.connection.findMany(),
    ]);

    const graph = dependencyManager.getProjectDependencyGraph(
      projectName,
      branch,
      nodes,
      connections,
    );

    return graph;
  }

  async validateEdgeCreation(fromId: string, toId: string) {
    const [fromNode, toNode] = await Promise.all([
      this.prisma.node.findUnique({ where: { id: fromId } }),
      this.prisma.node.findUnique({ where: { id: toId } }),
    ]);

    if (!fromNode || !toNode) {
      throw new NotFoundException('One or both nodes not found');
    }

    const isValid = dependencyManager.validateEdgeCreation(fromNode, toNode);
    return { valid: isValid };
  }
}