import { vi, beforeAll } from 'vitest'
import { mockPrisma } from './__mocks__/prisma-client'

// Global test setup - runs before all tests
beforeAll(() => {
  // Mock the global prisma instance for all tests
  vi.mock('../src/database/prisma', () => ({
    prisma: mockPrisma,
  }))
})
