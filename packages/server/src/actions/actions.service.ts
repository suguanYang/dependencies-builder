import { Injectable, NotFoundException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ActionQueryDto } from './dto/action-query.dto';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { executeCLI, getActiveExecution } from '../services/cli-service';
import { error as logError, info } from '../logging';
import { connectionWorkerPool } from '../workers/worker-pool';

@Injectable()
export class ActionsService {
  constructor(private prisma: PrismaService) { }

  async getActions(query: ActionQueryDto) {
    try {
      const { take, skip, ...where } = query;

      const [data, total] = await Promise.all([
        this.prisma.action.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: take ?? 100,
          skip: skip ?? 0,
        }),
        this.prisma.action.count({ where }),
      ]);

      return {
        data,
        total,
        limit: take ?? 100,
        offset: skip ?? 0,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch actions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getActionById(id: string) {
    try {
      const action = await this.prisma.action.findUnique({
        where: { id },
      });

      if (!action) {
        throw new NotFoundException('Action not found');
      }

      return action;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to fetch action',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createAction(createActionDto: CreateActionDto) {
    try {
      // Check if there are too many running actions (limit: 10)
      const runningActionsCount = await this.prisma.action.count({
        where: { status: 'running' },
      });

      if (runningActionsCount >= 10) {
        throw new ConflictException({
          error: 'Too many running actions',
          details: `Currently ${runningActionsCount} actions are running. Maximum allowed is 10.`,
        });
      }

      const parameters: Record<string, any> = {};

      // Only include project and branch if they exist (for connection_auto_create they won't)
      if (createActionDto.branch) parameters.branch = createActionDto.branch;
      if (createActionDto.targetBranch) parameters.targetBranch = createActionDto.targetBranch;
      if (createActionDto.projectName) parameters.projectName = createActionDto.projectName;
      if (createActionDto.projectAddr) parameters.projectAddr = createActionDto.projectAddr;

      const action = await this.prisma.action.create({
        data: {
          status: 'running',
          type: createActionDto.type,
          parameters,
        },
      });

      // Trigger execution based on action type
      if (createActionDto.type === 'connection_auto_create') {
        connectionWorkerPool.executeConnectionAutoCreation(action.id);
      } else if (createActionDto.type === 'static_analysis' || createActionDto.type === 'report') {
        executeCLI(action.id, createActionDto, () => {
          this.updateAction(action.id, {
            status: 'completed',
          })
        }, (err) => {
          this.updateAction(action.id, {
            status: 'failed',
          })

          if (err) {
            this.updateAction(action.id, {
              error: err,
            })
          }
        }).catch((error) => {
          this.prisma.action.update({
            where: { id: action.id },
            data: { status: 'failed' }
          });
          logError('Failed to execute action' + error);
        });
      }

      return action;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      logError('Failed to create action' + error);
      throw new InternalServerErrorException({
        error: 'Failed to create action',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateAction(id: string, updateActionDto: UpdateActionDto) {
    try {
      const updatedAction = await this.prisma.action.update({
        where: { id },
        data: {
          ...updateActionDto,
          updatedAt: new Date(),
        },
      });

      if (!updatedAction) {
        throw new NotFoundException('Action not found');
      }

      return updatedAction;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to update action',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteAction(id: string) {
    try {
      const success = await this.prisma.action.delete({
        where: { id },
      }).then(() => true).catch(() => false);

      if (!success) {
        throw new NotFoundException('Action not found');
      }

      const activeExecution = getActiveExecution(id);
      if (activeExecution) {
        await activeExecution.stop();
      }

      return { success: true, message: 'Action deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logError(error);
      throw new InternalServerErrorException({
        error: 'Failed to delete action',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async stopAction(id: string) {
    try {
      const action = await this.prisma.action.findUnique({
        where: { id },
      });

      if (!action) {
        throw new NotFoundException('Action not found');
      }

      if (action.type === 'connection_auto_create') {
        const success = connectionWorkerPool.stopExecution(id);
        if (!success) {
          throw new NotFoundException('Connection auto-creation not found');
        }
        this.updateAction(id, {
          status: 'failed',
          error: 'cancelled'
        })
        return { success: true, message: 'Connection auto-creation stopped' };
      }

      const activeExecution = getActiveExecution(id);

      if (activeExecution) {
        await activeExecution.stop();
        this.updateAction(id, {
          status: 'failed',
          error: 'cancelled'
        })
        return { success: true, message: 'Action execution stopped' };
      } else {
        throw new NotFoundException('Action not found or not running');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to stop action execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async triggerConnectionAutoCreation() {
    try {
      // Check if there are too many running actions (limit: 10)
      const runningActionsCount = await this.prisma.action.count({
        where: { status: 'running' },
      });

      if (runningActionsCount >= 10) {
        throw new ConflictException({
          error: 'Too many running actions',
          details: `Currently ${runningActionsCount} actions are running. Maximum allowed is 10.`,
        });
      }

      // Create the action record
      const action = await this.prisma.action.create({
        data: {
          status: 'pending',
          type: 'connection_auto_create',
          parameters: {},
        },
      });

      // Trigger connection auto-creation in worker thread
      const result = await connectionWorkerPool.executeConnectionAutoCreation(action.id);
      if (!result.success) {
        await this.prisma.action.update({
          where: { id: action.id },
          data: {
            status: 'failed',
            error: result.error,
          },
        });

        throw new InternalServerErrorException({
          error: 'Failed to trigger connection auto-creation',
          details: result.error,
        });
      }

      return action;
    } catch (error) {
      logError('Failed to trigger connection auto-creation: ' + error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to trigger connection auto-creation',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}