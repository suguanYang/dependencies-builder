import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processQuery } from './index'
import path from 'node:path'

// Mock dependencies
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  cpSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('../../context', () => ({
  getContext: vi.fn(),
}))

vi.mock('../../utils/fs-helper', () => ({
  ensureDirectoryExistsSync: vi.fn(),
}))

vi.mock('../../utils/constant', () => ({
  PACKAGE_ROOT: '/package/root',
}))

vi.mock('./entries', () => ({
  default: vi.fn().mockReturnValue([]),
}))

describe('CodeQL Queries Processing', () => {
  let readFileSync: any
  let getContext: any

  beforeEach(async () => {
    const fs = await import('node:fs')
    readFileSync = fs.readFileSync

    const context = await import('../../context')
    getContext = context.getContext

    vi.mocked(getContext).mockReturnValue({
      getMetadata: () => ({ name: 'test-project' }),
      getBranch: () => 'main',
      getVersion: () => '1.0.0',
      getQlsVersion: () => '1.0.0',
      getRepositoryDir: () => '/repo',
      getWorkingDirectory: () => '/work',
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('parseUrlParamQuery', () => {
    it('should clean up parameter names and deduplicate results', async () => {
      const mockUrlParamResult = {
        '#select': {
          tuples: [
            ['&showOrientation=true', 'UrlParamWrite', 'src/file.ts:10:1:10:20'],
            ['showOrientation', 'UrlParamWrite', 'src/file.ts:10:1:10:20'], // Duplicate after cleanup
            ['?otherParam', 'UrlParamRead', 'src/file.ts:20:1:20:15'],
          ],
        },
      }

      // Mock readFileSync to return empty results for other queries and our mock result for urlParam
      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes('urlParam.json')) {
          return JSON.stringify(mockUrlParamResult)
        }
        // Return empty result structure for other queries
        if (filePath.includes('export.json')) return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('import.json')) return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('libsDynamicImport.json'))
          return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('globalVariable.json'))
          return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('event.json')) return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('webStorage.json'))
          return JSON.stringify({ '#select': { tuples: [] } })
        if (filePath.includes('remoteLoader.json'))
          return JSON.stringify({ '#select': { tuples: [] } })
        return '{}'
      })

      const results = processQuery('/tmp/results')
      const urlParams = results.nodes.filter(
        (n) => n.type === 'UrlParamWrite' || n.type === 'UrlParamRead',
      )

      // Since we reverted deduplication in index.ts, we expect all inputs to be returned (minus filtered empty names)
      // Input has 3 items, all valid names after cleanup.
      // '&showOrientation=true' -> 'showOrientation'
      // 'showOrientation' -> 'showOrientation'
      // '?otherParam' -> 'otherParam'
      expect(urlParams).toHaveLength(3)

      // Check cleanup for showOrientation
      const showOrientations = urlParams.filter((n) => n.name === 'showOrientation')
      expect(showOrientations).toHaveLength(2)
      expect(showOrientations[0].type).toBe('UrlParamWrite')

      // Check cleanup for otherParam
      const otherParam = urlParams.find((n) => n.name === 'otherParam')
      expect(otherParam).toBeDefined()
      expect(otherParam?.type).toBe('UrlParamRead')
    })
  })
})
