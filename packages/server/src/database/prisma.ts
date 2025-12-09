import path from 'node:path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { error, info } from '../logging'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
} & {
  prisma: PrismaClient & {
    $on: (event: string, callback: (event: any) => void) => void
  }
}

// Initialize the Factory
const factory = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })

// Create a Proxy to intercept the connect() call
const proxyAdapter = {
  provider: 'sqlite' as const,
  adapterName: factory.adapterName,
  connect: async () => {
    const adapter = await factory.connect()

    // Load the native extension
    try {
      const extensionPath = path.resolve(process.cwd(), 'build/Release/sqlite_hook.node')
      const db = (adapter as any).client
      db.loadExtension(extensionPath)

      // Setup the NAPI callback
      // const addon = require('../../build/Release/sqlite_hook.node')
      // addon.setup(() => {
      //   import('../services/scheduler').then(({ ConnectionScheduler }) => {
      //     ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
      //   })
      // })

      info('SQLite update hook loaded successfully')
    } catch (e) {
      error('Failed to load SQLite update hook: ' + e)
    }

    return adapter
  },
  connectToShadowDb: async () => {
    return factory.connectToShadowDb()
  }
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: proxyAdapter })

prisma.$on('error', (e) => {
  error('prisma Error: ' + e.message)
})

prisma.$on('warn', (e) => {
  info('prisma Warn: ' + e.message)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
