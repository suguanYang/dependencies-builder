import fs from 'node:fs/promises'
import fss from 'node:fs'
import path from 'node:path'
import { IStorage } from '../interface'
import { constants } from 'node:fs'

export class FileStorage implements IStorage {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  private getFilePath(key: string): string {
    // Treat key slashes as directory separators
    // Sanitize components to prevent traversal
    const parts = key.split('/').map((part) => part.replace(/[^a-z0-9\-_\.]/gi, '_'))
    return path.join(this.baseDir, ...parts)
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    try {
      await fs.access(dir, constants.F_OK)
    } catch {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  async get(key: string): Promise<string | null> {
    const filePath = this.getFilePath(key)
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return data
    } catch (error) {
      // Return null if file doesn't exist or other read errors
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    const filePath = this.getFilePath(key)
    await this.ensureDir(filePath)
    await fs.writeFile(filePath, value, 'utf-8')
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async clear(prefix: string): Promise<void> {
    const targetPath = this.getFilePath(prefix)
    try {
      const stat = await fs.stat(targetPath)
      if (stat.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true })
      } else {
        await fs.unlink(targetPath)
      }
    } catch (error) {
      // Ignore if path doesn't exist
    }
  }

  async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key)
    try {
      await fs.access(filePath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  createReadStream(key: string) {
    const filePath = this.getFilePath(key)
    return fss.createReadStream(filePath, { encoding: 'utf-8' })
  }
}
