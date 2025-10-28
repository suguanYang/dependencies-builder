import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionQueryDto } from './dto/connection-query.dto';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get()
  async getConnections(@Query() query: ConnectionQueryDto) {
    return this.connectionsService.getConnections(query);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createConnection(@Body() createConnectionDto: CreateConnectionDto) {
    return this.connectionsService.createConnection(createConnectionDto);
  }

  @Delete('connections-by-from/:fromId')
  @UseGuards(AuthGuard)
  async deleteConnectionsByFrom(@Param('fromId') fromId: string) {
    return this.connectionsService.deleteConnectionsByFrom(fromId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteConnection(@Param('id') id: string) {
    return this.connectionsService.deleteConnection(id);
  }
}