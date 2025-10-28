import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { DependenciesService } from './dependencies.service';

@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get(':nodeId')
  async getDependencyGraph(@Param('nodeId') nodeId: string) {
    return this.dependenciesService.getDependencyGraph(nodeId);
  }

  @Get('projects/:projectName/:branch')
  async getProjectDependencyGraph(
    @Param('projectName') projectName: string,
    @Param('branch') branch: string,
  ) {
    return this.dependenciesService.getProjectDependencyGraph(projectName, branch);
  }

  @Post('validate')
  async validateEdgeCreation(@Body() body: { fromId: string; toId: string }) {
    return this.dependenciesService.validateEdgeCreation(body.fromId, body.toId);
  }
}