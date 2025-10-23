import { vi } from 'vitest'
import { mockNodes, mockConnections } from './test-data'

export const createMockPrismaClient = () => {
  const mockNodeMethods = {
    count: vi.fn().mockResolvedValue(mockNodes.length),
    findMany: vi.fn().mockResolvedValue(mockNodes),
    findUnique: vi.fn().mockImplementation(({ where }) => {
      return Promise.resolve(mockNodes.find((node) => node.id === where.id) || null)
    }),
    create: vi.fn().mockImplementation((data) => ({
      id: `node-${mockNodes.length + 1}`,
      ...data.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  }

  const mockConnectionMethods = {
    count: vi.fn().mockResolvedValue(mockConnections.length),
    findMany: vi.fn().mockResolvedValue(mockConnections),
    create: vi.fn().mockImplementation((data) => ({
      id: `conn-${mockConnections.length + 1}`,
      ...data.data,
      createdAt: new Date().toISOString(),
    })),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue({}),
  }

  return {
    node: mockNodeMethods,
    connection: mockConnectionMethods,
    $disconnect: vi.fn(),
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return await callback({
        node: {
          findMany: vi.fn().mockResolvedValue(mockNodes),
          count: vi.fn().mockResolvedValue(mockNodes.length),
        },
        connection: {
          findMany: vi.fn().mockResolvedValue(mockConnections),
          count: vi.fn().mockResolvedValue(mockConnections.length),
        },
      })
    }),
  }
}

export const mockPrisma = createMockPrismaClient()

export default mockPrisma
