import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DatabaseAdminService } from './database-admin.service';
import { DatabaseQueryDto } from './dto/database-query.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('database-admin')
export class DatabaseAdminController {
  constructor(private readonly databaseAdminService: DatabaseAdminService) {}

  @Post('query')
  @UseGuards(AuthGuard)
  async executeQuery(@Body() databaseQueryDto: DatabaseQueryDto) {
    return this.databaseAdminService.executeQuery(databaseQueryDto);
  }

  @Get('schema')
  @UseGuards(AuthGuard)
  async getSchema() {
    return this.databaseAdminService.getSchema();
  }

  @Get('tables/:tableName')
  @UseGuards(AuthGuard)
  async getTableInfo(@Param('tableName') tableName: string) {
    return this.databaseAdminService.getTableInfo(tableName);
  }

  @Post('api-keys')
  @UseGuards(AuthGuard)
  async createApiKey(@Body() createApiKeyDto: CreateApiKeyDto) {
    return this.databaseAdminService.createApiKey(createApiKeyDto);
  }

  @Get('api-keys')
  @UseGuards(AuthGuard)
  async getApiKeys() {
    return this.databaseAdminService.getApiKeys();
  }

  @Delete('api-keys/:id')
  @UseGuards(AuthGuard)
  async revokeApiKey(@Param('id') id: string) {
    return this.databaseAdminService.revokeApiKey(id);
  }
}