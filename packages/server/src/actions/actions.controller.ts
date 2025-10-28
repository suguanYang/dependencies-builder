import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionQueryDto } from './dto/action-query.dto';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  async getActions(@Query() query: ActionQueryDto) {
    return this.actionsService.getActions(query);
  }

  @Get(':id')
  async getActionById(@Param('id') id: string) {
    return this.actionsService.getActionById(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createAction(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.createAction(createActionDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateAction(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto) {
    return this.actionsService.updateAction(id, updateActionDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteAction(@Param('id') id: string) {
    return this.actionsService.deleteAction(id);
  }

  @Post(':id/stop')
  @UseGuards(AuthGuard)
  async stopAction(@Param('id') id: string) {
    return this.actionsService.stopAction(id);
  }

  @Post('connection-auto-create')
  @UseGuards(AuthGuard)
  async triggerConnectionAutoCreation() {
    return this.actionsService.triggerConnectionAutoCreation();
  }
}