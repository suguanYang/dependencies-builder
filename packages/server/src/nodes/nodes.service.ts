import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNodeDto, UpdateNodeDto } from './dto';

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  async findAll(where: any, take?: number, skip?: number) {
    const [data, total] = await Promise.all([
      this.prisma.node.findMany({
        where,
        take,
        skip,
      }),
      this.prisma.node.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findByIds(ids: string[]) {
    return this.prisma.node.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  async findById(id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return node;
  }

  async create(createNodeDto: CreateNodeDto) {
    if (createNodeDto.projectId) {
      return this.prisma.node.create({
        data: {
          ...createNodeDto,
          projectId: createNodeDto.projectId,
        },
      });
    }

    const project = await this.prisma.project.findFirst({
      where: {
        name: createNodeDto.projectName,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with name ${createNodeDto.projectName} not found`);
    }

    return this.prisma.node.create({
      data: {
        ...createNodeDto,
        projectId: project.id,
      },
    });
  }

  async createBatch(nodesData: CreateNodeDto[]) {
    const project = await this.prisma.project.findFirst({
      where: {
        name: nodesData[0].projectName,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with name ${nodesData[0].projectName} not found`);
    }

    const result = await this.prisma.node.createMany({
      data: nodesData.map((node) => ({
        ...node,
        projectId: project.id,
      })),
    });

    return { count: result.count };
  }

  async update(id: string, updateNodeDto: UpdateNodeDto) {
    const node = await this.prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return this.prisma.node.update({
      where: { id },
      data: updateNodeDto,
    });
  }

  async remove(id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    await this.prisma.node.delete({
      where: { id },
    });

    return { success: true, message: 'Node deleted successfully' };
  }
}