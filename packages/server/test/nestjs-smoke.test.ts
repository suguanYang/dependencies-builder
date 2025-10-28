import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../src/app.module'
import { INestApplication } from '@nestjs/common'

describe('NestJS API smoke tests', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    // Mock Prisma client
    vi.mock('../src/database/prisma', () => ({
      prisma: {
        node: {
          findMany: vi.fn().mockResolvedValue([
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
          ]),
          count: vi.fn().mockResolvedValue(1),
        },
        connection: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'conn-1',
              fromId: 'node-2',
              toId: 'node-1',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
          count: vi.fn().mockResolvedValue(1),
        },
        project: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'project-1',
              name: 'test-project',
              addr: 'test-addr',
              type: 'web',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
          count: vi.fn().mockResolvedValue(1),
        },
        action: {
          findMany: vi.fn().mockResolvedValue([
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
          ]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    }))

    // Mock CLI module
    vi.mock('@dms/cli', () => ({
      run: vi.fn().mockResolvedValue({ success: true }),
    }))

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication(new FastifyAdapter())
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /health - should return healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('OK')
    expect(body.database).toBe('connected')
  })

  it('GET / - should return API info', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.message).toBe('DMS Server API')
    expect(Array.isArray(body.endpoints)).toBe(true)
  })

  // it('GET /nodes - should return nodes array', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/nodes',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(body.data).toHaveLength(1)
  //   expect(body.total).toBe(1)
  //   expect(body.data[0].name).toBe('exportedFunction')
  // })

  // it('GET /connections - should return connections array', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/connections',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(body.data).toHaveLength(1)
  //   expect(body.total).toBe(1)
  //   expect(body.data[0].fromId).toBe('node-2')
  // })

  // it('GET /projects - should return projects array', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/projects',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(body.data).toHaveLength(1)
  //   expect(body.total).toBe(1)
  //   expect(body.data[0].name).toBe('test-project')
  // })

  // it('GET /actions - should return actions array', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/actions',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(body.data).toHaveLength(1)
  //   expect(body.total).toBe(1)
  //   expect(body.data[0].type).toBe('static_analysis')
  // })

  // it('GET /nodes/:id - should return specific node', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/nodes/node-1',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(body.id).toBe('node-1')
  //   expect(body.name).toBe('exportedFunction')
  // })

  // it('GET /dependencies - should return dependency graph', async () => {
  //   const response = await app.inject({
  //     method: 'GET',
  //     url: '/dependencies',
  //   })

  //   expect(response.statusCode).toBe(200)
  //   const body = response.json()
  //   expect(Array.isArray(body.vertices)).toBe(true)
  //   expect(Array.isArray(body.edges)).toBe(true)
  // })
})