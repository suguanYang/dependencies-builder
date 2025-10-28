import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { CreateNodeDto, UpdateNodeDto } from './dto';

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('name') name?: string,
    @Query('branch') branch?: string,
    @Query('projectName') projectName?: string,
  ) {
    const where: any = {};
    if (name) where.name = { contains: name };
    if (branch) where.branch = { contains: branch };
    if (projectName) where.projectName = { contains: projectName };

    const take = limit ? parseInt(limit, 10) : undefined;
    const skip = offset ? parseInt(offset, 10) : undefined;

    return this.nodesService.findAll(where, take, skip);
  }

  @Post('batch')
  async findByIds(@Body() body: { ids: string[] }) {
    if (!body.ids || !Array.isArray(body.ids)) {
      throw new Error('Invalid request body. Expected { ids: string[] }');
    }

    const nodes = await this.nodesService.findByIds(body.ids);
    return { data: nodes };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.nodesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createNodeDto: CreateNodeDto) {
    return this.nodesService.create(createNodeDto);
  }

  @Post('batch-create')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(@Body() nodesData: CreateNodeDto[]) {
    if (!nodesData || !Array.isArray(nodesData)) {
      throw new Error('Invalid request body. Expected array of nodes');
    }

    const result = await this.nodesService.createBatch(nodesData);
    return {
      message: `Successfully created ${result.count} nodes`,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateNodeDto: UpdateNodeDto) {
    return this.nodesService.update(id, updateNodeDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.nodesService.remove(id);
  }
}