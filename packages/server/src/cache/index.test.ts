import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Cache } from './index'

import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const TEST_CACHE_DIR = path.join(os.tmpdir(), 'dms-cache-test-' + Date.now())

describe('Cache Module', () => {
  let cache: Cache

  beforeEach(async () => {
    cache = new Cache({ dir: TEST_CACHE_DIR })
  })

  afterEach(async () => {
    try {
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true })
    } catch {}
  })

  it('should set and get a value', async () => {
    const key = 'test-key'
    const value = 'bar'

    await cache.set(key, value)
    const result = await cache.get(key)

    expect(result).toEqual(value)
  })

  it('should set and get a value with hierarchical key', async () => {
    const key = 'projects/graphs/master'
    const value = 'some-graph-json'

    await cache.set(key, value)
    const result = await cache.get(key)

    expect(result).toEqual(value)
  })

  it('should clear cache by prefix', async () => {
    await cache.set('projects/graphs/master', 'graph1')
    await cache.set('projects/graphs/dev', 'graph2')
    await cache.set('projects/other/data', 'data')

    await cache.clear('projects/graphs')

    const graph1 = await cache.get('projects/graphs/master')
    const graph2 = await cache.get('projects/graphs/dev')
    const other = await cache.get('projects/other/data')

    expect(graph1).toBeNull()
    expect(graph2).toBeNull()
    expect(other).toEqual('data')
  })
})
