import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { NodesController } from '../src/nodes/nodes.controller'
import { NodesService } from '../src/nodes/nodes.service'
import { DependenciesController } from '../src/dependencies/dependencies.controller'
import { DependenciesService } from '../src/dependencies/dependencies.service'
import { ConnectionsController } from '../src/connections/connections.controller'
import { ConnectionsService } from '../src/connections/connections.service'
import { ProjectsController } from '../src/projects/projects.controller'
import { ProjectsService } from '../src/projects/projects.service'
import { ActionsController } from '../src/actions/actions.controller'
import { ActionsService } from '../src/actions/actions.service'

// Simple smoke tests that test controllers directly without Better Auth middleware
describe('NestJS Controller smoke tests', () => {

  describe('NodesController', () => {
    let nodesController: NodesController
    let nodesService: NodesService

    const mockNodesService = {
      findAll: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'node-1',
            name: 'exportedFunction',
            type: 'NamedExport',
            projectName: 'test-project',
            branch: 'main',
            version: '1.0.0',
            relativePath: 'src/lib.ts',
            startLine: 10,
            startColumn: 5,
            endLine: 1,
            endColumn: 1,
            meta: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      }),
      findById: vi.fn().mockResolvedValue({
        id: 'node-1',
        name: 'exportedFunction',
        type: 'NamedExport',
        projectName: 'test-project',
        branch: 'main',
        version: '1.0.0',
        relativePath: 'src/lib.ts',
        startLine: 10,
        startColumn: 5,
        endLine: 1,
        endColumn: 1,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [NodesController],
        providers: [
          {
            provide: NodesService,
            useValue: mockNodesService,
          },
        ],
      }).compile()

      nodesController = moduleRef.get(NodesController)
      nodesService = moduleRef.get(NodesService)

        // Manually set the service since dependency injection might not work properly in tests
        ; (nodesController as any).nodesService = mockNodesService
    })

    it('GET /nodes - should return nodes array', async () => {
      const result = await nodesController.findAll()
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].name).toBe('exportedFunction')
      expect(mockNodesService.findAll).toHaveBeenCalled()
    })

    it('GET /nodes/:id - should return specific node', async () => {
      const result = await nodesController.findById('node-1')
      expect(result.id).toBe('node-1')
      expect(result.name).toBe('exportedFunction')
      expect(mockNodesService.findById).toHaveBeenCalledWith('node-1')
    })
  })

  describe('DependenciesController', () => {
    let dependenciesController: DependenciesController
    let dependenciesService: DependenciesService

    const mockDependenciesService = {
      getDependencyGraph: vi.fn().mockResolvedValue({
        vertices: [
          { id: 'node-1', name: 'exportedFunction' },
          { id: 'node-2', name: 'importedFunction' },
        ],
        edges: [
          { from: 'node-2', to: 'node-1' },
        ],
      }),
    }

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [DependenciesController],
        providers: [
          {
            provide: DependenciesService,
            useValue: mockDependenciesService,
          },
        ],
      }).compile()

      dependenciesController = moduleRef.get(DependenciesController)
      dependenciesService = moduleRef.get(DependenciesService)

        // Manually set the service since dependency injection might not work properly in tests
        ; (dependenciesController as any).dependenciesService = mockDependenciesService
    })

    it('GET /dependencies - should return dependency graph', async () => {
      const result = await dependenciesController.getDependencyGraph()
      expect(Array.isArray(result.vertices)).toBe(true)
      expect(Array.isArray(result.edges)).toBe(true)
      expect(result.vertices).toHaveLength(2)
      expect(result.edges).toHaveLength(1)
      expect(mockDependenciesService.getDependencyGraph).toHaveBeenCalled()
    })
  })

  describe('ConnectionsController', () => {
    let connectionsController: ConnectionsController
    let connectionsService: ConnectionsService

    const mockConnectionsService = {
      getConnections: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'conn-1',
            fromId: 'node-2',
            toId: 'node-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      }),
    }

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ConnectionsController],
        providers: [
          {
            provide: ConnectionsService,
            useValue: mockConnectionsService,
          },
        ],
      }).compile()

      connectionsController = moduleRef.get(ConnectionsController)
      connectionsService = moduleRef.get(ConnectionsService)

        // Manually set the service since dependency injection might not work properly in tests
        ; (connectionsController as any).connectionsService = mockConnectionsService
    })

    it('GET /connections - should return connections array', async () => {
      const result = await connectionsController.getConnections({})
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].fromId).toBe('node-2')
      expect(mockConnectionsService.getConnections).toHaveBeenCalledWith({})
    })
  })

  describe('ProjectsController', () => {
    let projectsController: ProjectsController
    let projectsService: ProjectsService

    const mockProjectsService = {
      getProjects: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'project-1',
            name: 'test-project',
            addr: 'test-addr',
            type: 'web',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      }),
    }

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ProjectsController],
        providers: [
          {
            provide: ProjectsService,
            useValue: mockProjectsService,
          },
        ],
      }).compile()

      projectsController = moduleRef.get(ProjectsController)
      projectsService = moduleRef.get(ProjectsService)

        // Manually set the service since dependency injection might not work properly in tests
        ; (projectsController as any).projectsService = mockProjectsService
    })

    it('GET /projects - should return projects array', async () => {
      const result = await projectsController.getProjects({})
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].name).toBe('test-project')
      expect(mockProjectsService.getProjects).toHaveBeenCalledWith({})
    })
  })

  describe('ActionsController', () => {
    let actionsController: ActionsController
    let actionsService: ActionsService

    const mockActionsService = {
      getActions: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'action-1',
            projectAddr: 'test-addr',
            projectName: 'test-project',
            branch: 'main',
            type: 'static_analysis',
            targetBranch: 'main',
            status: 'completed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      }),
    }

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ActionsController],
        providers: [
          {
            provide: ActionsService,
            useValue: mockActionsService,
          },
        ],
      }).compile()

      actionsController = moduleRef.get(ActionsController)
      actionsService = moduleRef.get(ActionsService)

        // Manually set the service since dependency injection might not work properly in tests
        ; (actionsController as any).actionsService = mockActionsService
    })

    it('GET /actions - should return actions array', async () => {
      const result = await actionsController.getActions({})
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].type).toBe('static_analysis')
      expect(mockActionsService.getActions).toHaveBeenCalledWith({})
    })
  })
})