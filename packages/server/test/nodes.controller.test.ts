import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { NodesController } from '../src/nodes/nodes.controller'
import { NodesService } from '../src/nodes/nodes.service'
import { CreateNodeDto } from '../src/nodes/dto/create-node.dto'
import { UpdateNodeDto } from '../src/nodes/dto/update-node.dto'
import { NodeType } from './types'

describe('NodesController', () => {
  let nodesController: NodesController
  let nodesService: NodesService

  const mockNodesService = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
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

  describe('findAll', () => {
    it('should return an array of nodes', async () => {
      const result = {
        data: [
          {
            id: '1',
            name: 'test-node',
            type: 'NamedExport' as NodeType,
            projectName: 'test-project',
            branch: 'main',
            version: '1.0.0',
            relativePath: 'src/index.ts',
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 1,
            meta: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      }
      mockNodesService.findAll.mockResolvedValue(result)

      expect(await nodesController.findAll()).toBe(result)
      expect(mockNodesService.findAll).toHaveBeenCalled()
    })
  })

  describe('findById', () => {
    it('should return a single node', async () => {
      const result = {
        id: '1',
        name: 'test-node',
        type: 'NamedExport' as NodeType,
        projectName: 'test-project',
        branch: 'main',
        version: '1.0.0',
        relativePath: 'src/index.ts',
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockNodesService.findById.mockResolvedValue(result)

      expect(await nodesController.findById('1')).toBe(result)
      expect(mockNodesService.findById).toHaveBeenCalledWith('1')
    })
  })

  describe('create', () => {
    it('should create a new node', async () => {
      const createNodeDto: CreateNodeDto = {
        name: 'test-node',
        branch: 'main',
        projectName: 'test-project',
        projectId: 'test-project',
        version: '1.0.0',
        type: 'NamedExport' as NodeType,
        relativePath: 'src/index.ts',
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
        meta: {},
      }

      const result = {
        id: '1',
        ...createNodeDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockNodesService.create.mockResolvedValue(result)

      expect(await nodesController.create(createNodeDto)).toBe(result)
      expect(mockNodesService.create).toHaveBeenCalledWith(createNodeDto)
    })
  })

  describe('update', () => {
    it('should update a node', async () => {
      const updateNodeDto: UpdateNodeDto = {
        name: 'updated-node',
      }

      const result = {
        id: '1',
        name: 'updated-node',
        type: 'NamedExport' as NodeType,
        projectName: 'test-project',
        branch: 'main',
        version: '1.0.0',
        relativePath: 'src/index.ts',
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockNodesService.update.mockResolvedValue(result)

      expect(await nodesController.update('1', updateNodeDto)).toBe(result)
      expect(mockNodesService.update).toHaveBeenCalledWith('1', updateNodeDto)
    })
  })

  describe('remove', () => {
    it('should remove a node', async () => {
      const result = {
        id: '1',
        name: 'test-node',
        type: 'NamedExport' as NodeType,
        projectName: 'test-project',
        branch: 'main',
        version: '1.0.0',
        relativePath: 'src/index.ts',
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockNodesService.remove.mockResolvedValue(result)

      expect(await nodesController.remove('1')).toBe(result)
      expect(mockNodesService.remove).toHaveBeenCalledWith('1')
    })
  })
})