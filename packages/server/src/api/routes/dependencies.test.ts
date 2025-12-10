import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'

// Mock dependency builder worker pool
vi.mock('../../workers/dependency-builder-pool', () => ({
  DependencyBuilderWorkerPool: {
    getPool: () => ({
      getNodeDependencyGraph: async () =>
        JSON.stringify({
          vertices: [{ data: { id: 'n1' } }, { data: { id: 'n2' } }],
          edges: [{ from: 'n1', to: 'n2' }],
        }),
      getProjectLevelDependencyGraph: async () =>
        JSON.stringify({ vertices: [{ data: { id: 'p1' } }], edges: [] }),
    }),
  },
}))

describe('Dependencies API', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    // Tests are mocked, so DB cleanup is less critical but good practice if we add integration tests later
    await prisma.connection.deleteMany()
    await prisma.node.deleteMany()
    await prisma.project.deleteMany()
  })

  afterEach(async () => {
    await prisma.connection.deleteMany()
    await prisma.node.deleteMany()
    await prisma.project.deleteMany()
  })

  it('should get node dependencies (mocked)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/dependencies/nodes/test-node-id',
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.vertices).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })

  it('should get project dependencies (mocked)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/dependencies/projects/test-project-id/main',
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.vertices).toHaveLength(1)
  })
})
