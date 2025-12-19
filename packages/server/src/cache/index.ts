import { ICache, IStorage } from './interface'
import { FileStorage } from './storages/file-storage'
import path from 'node:path'
import os from 'node:os'

const DEFAULT_CACHE_DIR = path.join(
  process.env.DMS_LOCAL_DIR || path.join(os.homedir(), '.dms'),
  'cache',
)

export type CacheConfig = {
  driver?: 'file'
  dir?: string
}

export class Cache implements ICache {
  private storage: IStorage

  constructor(config: CacheConfig = {}) {
    const driver = config.driver || 'file'
    const dir = config.dir || DEFAULT_CACHE_DIR

    if (driver === 'file') {
      this.storage = new FileStorage(dir)
    } else {
      throw new Error(`Unsupported cache driver: ${driver}`)
    }
  }

  async get(key: string): Promise<string | null> {
    return this.storage.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    await this.storage.set(key, value)
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key)
  }

  async clear(prefix: string): Promise<void> {
    await this.storage.clear(prefix)
  }

  async has(key: string): Promise<boolean> {
    return this.storage.has(key)
  }

  createReadStream(key: string) {
    return this.storage.createReadStream(key)
  }
}
