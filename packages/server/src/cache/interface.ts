import { Readable } from 'node:stream'

export interface IStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(prefix: string): Promise<void>
  has(key: string): Promise<boolean>
  createReadStream(key: string): Readable
}

export interface ICache {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(prefix: string): Promise<void>
  has(key: string): Promise<boolean>
  createReadStream(key: string): Readable
}
