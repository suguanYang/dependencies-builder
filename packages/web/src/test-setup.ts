import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    getAll: vi.fn(),
    has: vi.fn(),
    entries: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    toString: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock next/font
vi.mock('next/font/google', () => ({
  Inter: () => ({
    style: {
      fontFamily: 'mock-font',
    },
  }),
}))
