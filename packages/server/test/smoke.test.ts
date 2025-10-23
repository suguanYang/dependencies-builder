import { describe, it, expect, beforeAll, afterAll, vi, Mock } from 'vitest'
import Fastify from 'fastify'
import { setupAPI } from '../src/api'

async function createTestServer() {
  const fastify = Fastify({ logger: false })
  await setupAPI(fastify)
  return fastify
}

// Mock the dependency module
vi.mock('../src/dependency', () => ({
  getFullDependencyGraph: vi.fn().mockReturnValue({
    vertices: [
      {
        data: {
          id: 'node-1',
          name: 'exportedFunction',
          type: 'NamedExport',
          project: 'test-project',
          branch: 'main',
        },
        firstIn: 0,
        firstOut: -1,
      },
      {
        data: {
          id: 'node-2',
          name: 'importedFunction',
          type: 'NamedImport',
          project: 'test-project',
          branch: 'main',
        },
        firstIn: -1,
        firstOut: 0,
      },
    ],
    edges: [
      {
        data: { id: 'conn-1', fromId: 'node-2', toId: 'node-1' },
        tailvertex: 1,
        headvertex: 0,
        headnext: -1,
        tailnext: -1,
      },
    ],
  }),
  getProjectDependencyGraph: vi.fn().mockReturnValue({
    vertices: [
      {
        data: {
          id: 'node-1',
          name: 'exportedFunction',
          type: 'NamedExport',
          project: 'test-project',
          branch: 'main',
        },
        firstIn: 0,
        firstOut: -1,
      },
    ],
    edges: [],
  }),
  validateEdgeCreation: vi.fn().mockImplementation((fromNode, toNode) => {
    // Mock validation logic
    const validTypePairs: Record<string, string[]> = {
      NamedImport: ['NamedExport'],
      RuntimeDynamicImport: ['NamedExport'],
      EventOn: ['EventEmit'],
      DynamicModuleFederationReference: ['NamedExport'],
    }

    const allowedTargets = validTypePairs[fromNode.type]
    return allowedTargets ? allowedTargets.includes(toNode.type) : false
  }),
}))
describe('API smoke tests', () => {
  let server: Awaited<ReturnType<typeof createTestServer>>

  beforeAll(async () => {
    server = await createTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /health - should return healthy status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('OK')
    expect(body.database).toBe('connected')
  })

  it('GET / - should return API info', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.message).toBe('DMS Server API')
    expect(Array.isArray(body.endpoints)).toBe(true)
  })

  it('GET /nodes - should return nodes array', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/nodes',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(3) // From mock data
    expect(body.total).toBe(3)
  })

  it('GET /connections - should return connections array', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/connections',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(2) // From mock data
    expect(body.total).toBe(2)
  })

  it('GET /dependencies/projects/test-project/main - should return project dependency graph', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/dependencies/projects/test-project/main',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(Array.isArray(body.vertices)).toBe(true)
    expect(Array.isArray(body.edges)).toBe(true)
    expect(body.vertices.length).toBe(1) // From mock data
    expect(body.edges.length).toBe(0) // From mock data
  })

  it('POST /nodes - should create a node', async () => {
    const nodeData = {
      project: 'test-project',
      branch: 'main',
      type: 'NamedExport',
      name: 'testFunction',
      relativePath: 'src/index.ts',
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
      version: '1.0.0',
      meta: {},
    }

    const response = await server.inject({
      method: 'POST',
      url: '/nodes',
      payload: nodeData,
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.project).toBe('test-project')
    expect(body.name).toBe('testFunction')
    expect(body.type).toBe('NamedExport')
  })

  it('GET /nodes/:id - should return specific node', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/nodes/node-1',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.id).toBe('node-1')
    expect(body.name).toBe('exportedFunction')
  })

  it('POST /connections - should create connection between nodes', async () => {
    // Mock the prisma to return valid nodes for connection creation
    const { prisma } = await import('../src/database/prisma')
    ;(prisma.node.findUnique as Mock)
      .mockResolvedValueOnce({
        id: 'node-2',
        project: 'test-project',
        branch: 'main',
        type: 'NamedImport',
        name: 'importedFunction',
        relativePath: 'src/app.ts',
        startLine: 15,
        startColumn: 8,
        endLine: 1,
        endColumn: 1,
        version: '1.0.0',
        meta: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        id: 'node-1',
        project: 'test-project',
        branch: 'main',
        type: 'NamedExport',
        name: 'exportedFunction',
        relativePath: 'src/lib.ts',
        startLine: 10,
        startColumn: 5,
        endLine: 1,
        endColumn: 1,
        version: '1.0.0',
        meta: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

    const response = await server.inject({
      method: 'POST',
      url: '/connections',
      payload: {
        fromId: 'node-2',
        toId: 'node-1',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.fromId).toBe('node-2')
    expect(body.toId).toBe('node-1')
  })
})
