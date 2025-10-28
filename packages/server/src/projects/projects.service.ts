import { Injectable, NotFoundException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProjectQueryDto } from './dto/project-query.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async getProjects(query: ProjectQueryDto) {
    try {
      const { take, skip, ...where } = query;

      const [data, total] = await Promise.all([
        this.prisma.project.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: take ?? 100,
          skip: skip ?? 0,
        }),
        this.prisma.project.count({ where }),
      ]);

      return {
        data,
        total,
        limit: take ?? 100,
        offset: skip ?? 0,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch projects',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getProjectById(id: string) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return project;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to fetch project',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getProjectByName(name: string) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { name },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return project;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to fetch project',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createProject(createProjectDto: CreateProjectDto) {
    try {
      // Check if project already exists with the same name
      const existingProject = await this.prisma.project.findUnique({
        where: { name: createProjectDto.name },
      });

      if (existingProject) {
        throw new ConflictException(`Project with name '${createProjectDto.name}' already exists`);
      }

      const createdProject = await this.prisma.project.create({
        data: createProjectDto,
      });
      return createdProject;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateProject(id: string, updateProjectDto: UpdateProjectDto) {
    try {
      const updatedProject = await this.prisma.project.update({
        where: { id },
        data: updateProjectDto,
      });

      if (!updatedProject) {
        throw new NotFoundException('Project not found');
      }

      return updatedProject;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException({
        error: 'Failed to update project',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteProject(id: string) {
    try {
      const success = await this.prisma.project.delete({
        where: { id },
      }).then(() => true).catch(() => false);

      if (!success) {
        throw new NotFoundException('Project not found');
      }

      return { success: true, message: 'Project deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to delete project',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}